# Huddly Security Architecture & Threat Model

> **Last Updated:** 17 August 2026  
> **Status:** M1 Foundation Specification

---

## 1. Authentication & Credential Storage

### Argon2id Password Hashing

- **Algorithm:** Argon2id (v13)
- **Parameters:** Memory Cost: 64 MiB (`65536 KiB`), Time Cost: 3 iterations, Parallelism: 4 threads.
- **Payload Limits:** Minimum 8 characters, maximum 128 characters to prevent long-string CPU exhaustion (DoS).
- **Sanitization Invariant:** `passwordHash` is never selected or serialized in API responses.

### User Enumeration & Timing-Attack Mitigation

- When `POST /api/v1/auth/login` receives a non-existent email or guest account, it invokes `dummyVerify()`, verifying against a static Argon2id hash.
- Authentication responses maintain uniform response times (~50ms) regardless of whether an account exists.

### Email Normalization

- All incoming emails are canonicalized via `email.trim().toLowerCase()` prior to database query or persistence, preventing case-variance account duplicates.

### OAuth 2.0 PKCE & State Parameter Protection

- **PKCE (RFC 7636):** Code verifiers are high-entropy CSPRNG strings (default 64 characters, between 43–128 base64url characters generated via `crypto.randomBytes`). Code challenges are computed using SHA-256 (`S256`) and base64url encoding. Challenge verification uses `crypto.timingSafeEqual` to prevent side-channel timing analysis.
- **CSRF State Tokens:** Generated via authenticated AES-256-GCM encryption using an scrypt-derived key (`crypto.scryptSync(JWT_SECRET, 'huddly-oauth-state-salt', 32)`) and a 12-byte random IV. Encrypted state tokens are serialized as `<iv>.<ciphertext>.<authTag>` in base64url format.
- **State Validation Invariants:**
  - Authenticated GCM decryption enforces payload tamper resistance.
  - Verifies exact provider match against the encrypted `provider` claim.
  - Enforces a strict 10-minute maximum expiration window (`STATE_MAX_AGE_MS = 600,000ms`) with future-timestamp skew protection (max 60s).
  - Embeds a 16-byte random hex `nonce` to ensure state uniqueness.

---

## 2. Session & Token Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       Token Lifecycles                      │
├─────────────────────────────────────────────────────────────┤
│ Access Token:  Short-lived JWT (15 minutes)                 │
│                Claims: sub, email, displayName, isGuest     │
├─────────────────────────────────────────────────────────────┤
│ Refresh Token: High-entropy 256-bit random hex string       │
│                Stored as SHA-256 hash in user_devices       │
├─────────────────────────────────────────────────────────────┤
│ WS Ticket:     Single-use UUID, 60s TTL in Redis (DB 1)     │
│                Consumed atomically via GETDEL on WS connect │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Realtime & Network Threat Mitigations

| Threat Vector                      | Mitigation Strategy                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **WebSocket Connection Hijacking** | Single-use tickets minted via authenticated REST endpoint, stored in Redis with 60s TTL, consumed atomically with `GETDEL`.        |
| **Gateway Message Flooding**       | Per-connection rolling rate limiter enforcing a maximum of 25 messages per 1,000ms window with instant `RATE_LIMITED` termination. |
| **Unauthorized Playback Control**  | Host-only authorization gate on all `PLAYBACK_*` mutation events.                                                                  |
| **Cross-Site Scripting (XSS)**     | Text content sanitization and plain text rendering in chat interfaces.                                                             |
| **Session Fixation**               | Unique session device and refresh token hash generated per authentication event.                                                   |

---

## 4. Security Audit Logging & Telemetry

Authentication and session lifecycle events are recorded to PostgreSQL `audit_events` via `recordAuthAuditEvent()` (`services/api/src/utils/audit.ts`):

- **Non-Blocking / Fire-and-Forget:** Audit log writes are non-blocking and never awaited in the critical authentication path. Database write promises catch errors internally so that audit logging failures never delay client responses or cause unhandled rejections.
- **Supported Event Types (`AuthAuditEventType`):**
  - `AUTH_REGISTER_SUCCESS`: Successful user registration.
  - `AUTH_LOGIN_SUCCESS`: Successful password or OAuth authentication.
  - `AUTH_LOGIN_FAILURE`: Failed login attempt, invalid credentials, CSRF state verification failure, or inactive account.
  - `AUTH_LOGOUT`: Explicit session termination and token invalidation.
  - `AUTH_REFRESH_SUCCESS`: Successful refresh token rotation.
  - `AUTH_REFRESH_FAILURE`: Invalid, expired, or revoked refresh token exchange attempt.
  - `AUTH_GUEST_CREATED`: Anonymous guest session minting.
- **Audit Detail Invariant:** Client IP addresses, user agents, provider names, and failure reasons are structured within the `details` JSONB column.

---

## 5. Reporting Security Vulnerabilities

Please report potential security vulnerabilities privately via GitHub Security Advisories or by contacting the repository maintainers directly.
