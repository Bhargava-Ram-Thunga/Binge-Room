# BingeRoom — Complete Database Schema

> **Status**: Planning document only. No migrations run. No code generated.
> **Date**: 2026-04-18
> **Platform target**: YouTube (Phase 1), Netflix / Prime / Disney+ (future)
> **Scale target**: 1 million users from day one
> **Auth**: Email/password and Google OAuth only — no guest mode, no GitHub login

---

## Table of Contents

1. [Group 1 — Identity and Auth](#group-1--identity-and-auth)
2. [Group 2 — Room and Membership](#group-2--room-and-membership)
3. [Group 3 — Video and Sync](#group-3--video-and-sync)
4. [Group 4 — Complete User Behavior](#group-4--complete-user-behavior)
5. [Group 5 — Chat and Reactions](#group-5--chat-and-reactions)
6. [Group 6 — Call (Daily.co)](#group-6--call-dailyco)
7. [Group 7 — Analytics and Growth](#group-7--analytics-and-growth)
8. [Group 8 — Infrastructure, Security, Compliance](#group-8--infrastructure-security-compliance)
9. [Redis Keys Reference](#redis-keys-reference)
10. [Relationships Diagram](#relationships-diagram)
11. [Design Decisions](#design-decisions)
12. [High Volume Tables](#high-volume-tables)
13. [Column Extraction Capabilities](#column-extraction-capabilities)

---

## Group 1 — Identity and Auth

---

### USERS

**Purpose**: Single source of truth for every registered account on the platform.

**Write frequency**: Low — account creation, profile updates, login counters, status changes
**Read frequency**: Very high — every authenticated request reads this table
**Retention**: Forever (soft-delete pattern; `deleted_at` set, row kept for audit)
**PII**: YES — `email`, `display_name`, `avatar_url`, `timezone`, `country_code`, `region`, `city`, `registration_ip`, `last_known_ip`, `last_known_city`, `referred_by_*`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clx9abc123def |
| 2 | email | TEXT | NO | — | Login email address **(PII)** | user@example.com |
| 3 | email_hash | TEXT | NO | — | SHA-256 of lowercase email for safe analytics joins | a9b4c3... |
| 4 | email_verified | BOOLEAN | NO | false | Whether email has been confirmed | true |
| 5 | email_verified_at | TIMESTAMPTZ | YES | NULL | When email was first verified | 2026-01-15T10:00:00Z |
| 6 | password_hash | TEXT | YES | NULL | Argon2id hash; NULL for pure OAuth accounts | $argon2id$v=19... |
| 7 | auth_methods | TEXT[] | NO | '{}' | Auth methods enabled: email_password, google_oauth | {email_password,google_oauth} |
| 8 | google_id | TEXT | YES | NULL | Google OAuth `sub` claim **(PII)** | 109876543210987654321 |
| 9 | display_name | TEXT | YES | NULL | User-chosen display name **(PII)** | Alex Chen |
| 10 | username | TEXT | YES | NULL | Unique slug-style username | alexchen |
| 11 | avatar_url | TEXT | YES | NULL | Profile picture URL **(PII)** | https://lh3.google.com/... |
| 12 | avatar_source | TEXT | YES | NULL | Where avatar came from: google, upload, gravatar | google |
| 13 | bio | TEXT | YES | NULL | User bio (max 300 chars) | Movie addict 🎬 |
| 14 | created_at | TIMESTAMPTZ | NO | now() | Account creation timestamp | 2026-01-15T09:58:00Z |
| 15 | updated_at | TIMESTAMPTZ | NO | now() | Last record update | 2026-01-15T10:00:00Z |
| 16 | last_login_at | TIMESTAMPTZ | YES | NULL | Most recent successful login | 2026-04-18T08:00:00Z |
| 17 | last_seen_at | TIMESTAMPTZ | YES | NULL | Most recent activity (any action) | 2026-04-18T09:30:00Z |
| 18 | login_count | INTEGER | NO | 0 | Total lifetime successful logins | 47 |
| 19 | failed_login_count | INTEGER | NO | 0 | Total lifetime failed login attempts | 2 |
| 20 | failed_login_last_at | TIMESTAMPTZ | YES | NULL | Timestamp of most recent failed login | 2026-04-10T12:00:00Z |
| 21 | account_status | TEXT | NO | 'active' | active / suspended / deactivated / deleted / pending_verification | active |
| 22 | suspension_reason | TEXT | YES | NULL | Human-readable reason for suspension | Repeated ToS violations |
| 23 | suspension_started_at | TIMESTAMPTZ | YES | NULL | When suspension began | NULL |
| 24 | suspension_expires_at | TIMESTAMPTZ | YES | NULL | NULL means permanent | NULL |
| 25 | suspended_by_user_id | TEXT | YES | NULL | FK to admin user who suspended | NULL |
| 26 | deletion_requested_at | TIMESTAMPTZ | YES | NULL | When user requested account deletion (GDPR) | NULL |
| 27 | deletion_scheduled_at | TIMESTAMPTZ | YES | NULL | When deletion will execute (30-day grace) | NULL |
| 28 | deleted_at | TIMESTAMPTZ | YES | NULL | Soft-delete timestamp | NULL |
| 29 | onboarding_state | TEXT | NO | 'not_started' | not_started / in_progress / completed | completed |
| 30 | onboarding_step | TEXT | YES | NULL | Last onboarding step reached | install_extension |
| 31 | onboarding_completed_at | TIMESTAMPTZ | YES | NULL | When onboarding was completed | 2026-01-15T10:15:00Z |
| 32 | profile_completeness_score | SMALLINT | NO | 0 | 0–100 computed score (name + avatar + bio = 100) | 75 |
| 33 | referral_source | TEXT | YES | NULL | Top-level source: organic, invite, ads, social | invite |
| 34 | referral_utm_source | TEXT | YES | NULL | UTM source from registration URL | google |
| 35 | referral_utm_medium | TEXT | YES | NULL | UTM medium | cpc |
| 36 | referral_utm_campaign | TEXT | YES | NULL | UTM campaign | spring_launch |
| 37 | referral_utm_content | TEXT | YES | NULL | UTM content variant | banner_a |
| 38 | referral_utm_term | TEXT | YES | NULL | UTM keyword term | watch party |
| 39 | referred_by_user_id | TEXT | YES | NULL | FK → USERS; who invited this user | clxhost456 |
| 40 | referred_by_invite_token_id | TEXT | YES | NULL | FK → INVITE_TOKENS; which invite token was used | clxinv789 |
| 41 | timezone | TEXT | YES | NULL | IANA timezone string **(PII)** | America/New_York |
| 42 | locale | TEXT | YES | NULL | BCP-47 locale code | en-US |
| 43 | country_code | TEXT | YES | NULL | ISO 3166-1 alpha-2 from registration IP **(PII)** | US |
| 44 | region | TEXT | YES | NULL | State/province at registration **(PII)** | California |
| 45 | city | TEXT | YES | NULL | City at registration (approximate) **(PII)** | San Francisco |
| 46 | registration_ip | INET | YES | NULL | IP at signup **(PII)** | 192.168.1.1 |
| 47 | registration_device_id | TEXT | YES | NULL | FK → USER_DEVICES | clxdev321 |
| 48 | notification_email_enabled | BOOLEAN | NO | true | Master switch for email notifications | true |
| 49 | notification_email_digest | TEXT | NO | 'weekly' | never / daily / weekly | weekly |
| 50 | notification_push_enabled | BOOLEAN | NO | true | Browser push notifications | true |
| 51 | notification_in_app_enabled | BOOLEAN | NO | true | In-app toast notifications | true |
| 52 | notification_room_invites | BOOLEAN | NO | true | Notify when invited to a room | true |
| 53 | notification_room_starts | BOOLEAN | NO | false | Notify when a followed room starts | false |
| 54 | notification_message_mentions | BOOLEAN | NO | true | Notify on @mention in chat | true |
| 55 | two_factor_enabled | BOOLEAN | NO | false | TOTP 2FA active | false |
| 56 | two_factor_method | TEXT | YES | NULL | totp / sms (future) | NULL |
| 57 | two_factor_enabled_at | TIMESTAMPTZ | YES | NULL | When 2FA was activated | NULL |
| 58 | roles | TEXT[] | NO | '{user}' | Platform roles: user, admin, moderator | {user} |
| 59 | is_premium | BOOLEAN | NO | false | Active premium subscriber | false |
| 60 | premium_started_at | TIMESTAMPTZ | YES | NULL | When premium began | NULL |
| 61 | premium_expires_at | TIMESTAMPTZ | YES | NULL | When premium expires (NULL = active subscription) | NULL |
| 62 | plan_name | TEXT | YES | NULL | free / pro / team | free |
| 63 | stripe_customer_id | TEXT | YES | NULL | Stripe customer identifier | cus_abc123 |
| 64 | total_rooms_hosted | INTEGER | NO | 0 | Lifetime rooms hosted (denormalized) | 12 |
| 65 | total_rooms_joined | INTEGER | NO | 0 | Lifetime rooms joined as member | 38 |
| 66 | total_watch_time_seconds | BIGINT | NO | 0 | Lifetime watch time across all rooms | 432000 |
| 67 | total_messages_sent | INTEGER | NO | 0 | Lifetime messages sent | 847 |
| 68 | preferred_video_quality | TEXT | YES | NULL | User quality preference: auto, 1080p, 720p, etc. | auto |
| 69 | preferred_playback_speed | NUMERIC(3,2) | NO | 1.00 | Default playback speed | 1.00 |
| 70 | extension_installed_at | TIMESTAMPTZ | YES | NULL | When extension was first detected | 2026-01-15T10:05:00Z |
| 71 | extension_current_version | TEXT | YES | NULL | Currently active extension version | 1.4.2 |
| 72 | extension_last_seen_version | TEXT | YES | NULL | Last version we observed (may differ if stale) | 1.4.1 |
| 73 | last_known_ip | INET | YES | NULL | Most recent IP address **(PII)** | 10.0.0.1 |
| 74 | last_known_country | TEXT | YES | NULL | Country from last_known_ip | US |
| 75 | last_known_city | TEXT | YES | NULL | City from last_known_ip (approximate) **(PII)** | Seattle |
| 76 | last_known_device_id | TEXT | YES | NULL | FK → USER_DEVICES | clxdev321 |
| 77 | metadata | JSONB | NO | '{}' | Extensible bag for future fields | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (email)            — one account per email address
UNIQUE (username)         — unique public handles
UNIQUE (google_id) WHERE google_id IS NOT NULL  — one account per Google identity
FK: suspended_by_user_id → USERS.id ON DELETE SET NULL
FK: referred_by_user_id  → USERS.id ON DELETE SET NULL
FK: referred_by_invite_token_id → INVITE_TOKENS.id ON DELETE SET NULL
FK: registration_device_id → USER_DEVICES.id ON DELETE SET NULL
FK: last_known_device_id   → USER_DEVICES.id ON DELETE SET NULL
CHECK (profile_completeness_score BETWEEN 0 AND 100)
CHECK (account_status IN ('active','suspended','deactivated','deleted','pending_verification'))
CHECK (preferred_playback_speed BETWEEN 0.25 AND 2.0)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| users_pkey | id | BTREE | PK lookup |
| idx_users_email | email | BTREE | Login lookup |
| idx_users_email_hash | email_hash | BTREE | Analytics joins without PII |
| idx_users_google_id | google_id | BTREE | OAuth login |
| idx_users_username | username | BTREE | Profile URL lookup |
| idx_users_account_status | account_status | BTREE | Admin queries, suspension checks |
| idx_users_created_at | created_at | BTREE | Growth dashboards |
| idx_users_last_seen_at | last_seen_at | BTREE | Churn detection, DAU/WAU |
| idx_users_referred_by | referred_by_user_id | BTREE | Referral tree queries |
| idx_users_stripe | stripe_customer_id | BTREE | Billing webhooks |
| idx_users_is_premium | is_premium, premium_expires_at | BTREE | Premium expiry jobs |

**Partition strategy**: None — row count stays manageable (1 row per user). Archive deleted accounts to cold storage after 3 years post-deletion.

**Example row**:
```json
{
  "id": "clx9abc123def",
  "email": "alex@example.com",
  "email_hash": "a9b4c3d2e1f0...",
  "email_verified": true,
  "email_verified_at": "2026-01-15T10:00:00Z",
  "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$...",
  "auth_methods": ["email_password", "google_oauth"],
  "google_id": "109876543210987654321",
  "display_name": "Alex Chen",
  "username": "alexchen",
  "avatar_url": "https://lh3.googleusercontent.com/a/...",
  "account_status": "active",
  "onboarding_state": "completed",
  "referral_source": "invite",
  "referral_utm_campaign": "spring_launch",
  "roles": ["user"],
  "is_premium": false,
  "plan_name": "free",
  "total_rooms_hosted": 5,
  "total_watch_time_seconds": 86400,
  "created_at": "2026-01-15T09:58:00Z"
}
```

**Developer notes**: `email_hash` is computed server-side before insert so analytics queries can join on email without touching raw PII. Never expose `password_hash`, `registration_ip`, `last_known_ip` in API responses. `auth_methods` is an array so a user can have both email/password AND Google linked. `total_rooms_hosted` / `total_messages_sent` are denormalized counters incremented in the same transaction as the source write — do not recompute from aggregates in hot paths.

---

### EMAIL_VERIFICATION_TOKENS

**Purpose**: Tracks every email verification and email-change token sent to users.

**Write frequency**: Low — created on registration and email change requests
**Read frequency**: Low — only on token redemption and resend requests
**Retention**: 90 days — short; after use/expiry these have no ongoing value
**PII**: YES — `email`, `ip_address`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxevt001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | token_hash | TEXT | NO | — | SHA-256 of the raw token (never store raw) | e3b0c44298... |
| 4 | email | TEXT | NO | — | Email address being verified **(PII)** | alex@example.com |
| 5 | type | TEXT | NO | — | email_verification / email_change | email_verification |
| 6 | status | TEXT | NO | 'pending' | pending / used / expired / cancelled | pending |
| 7 | created_at | TIMESTAMPTZ | NO | now() | When token was created | 2026-01-15T09:58:10Z |
| 8 | expires_at | TIMESTAMPTZ | NO | — | Token expiry (24h from creation) | 2026-01-16T09:58:10Z |
| 9 | used_at | TIMESTAMPTZ | YES | NULL | When token was successfully redeemed | NULL |
| 10 | ip_address | INET | YES | NULL | IP that triggered the verification request **(PII)** | 192.168.1.1 |
| 11 | user_agent | TEXT | YES | NULL | UA string at request time | Mozilla/5.0... |
| 12 | attempt_count | SMALLINT | NO | 0 | How many times redemption was attempted (wrong token) | 0 |
| 13 | last_attempt_at | TIMESTAMPTZ | YES | NULL | Last redemption attempt time | NULL |
| 14 | delivery_status | TEXT | NO | 'not_sent' | not_sent / sent / failed | sent |
| 15 | delivery_sent_at | TIMESTAMPTZ | YES | NULL | When email was dispatched | 2026-01-15T09:58:12Z |
| 16 | delivery_error | TEXT | YES | NULL | Error message if delivery failed | NULL |
| 17 | resend_count | SMALLINT | NO | 0 | How many times user requested resend | 0 |
| 18 | last_resent_at | TIMESTAMPTZ | YES | NULL | Most recent resend timestamp | NULL |
| 19 | metadata | JSONB | NO | '{}' | Provider message ID, etc. | {"sendgrid_id": "abc"} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (token_hash)          — tokens are globally unique
FK: user_id → USERS.id ON DELETE CASCADE   — delete tokens when user deleted
CHECK (status IN ('pending','used','expired','cancelled'))
CHECK (type IN ('email_verification','email_change'))
CHECK (attempt_count >= 0)
CHECK (resend_count >= 0)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_evt_token_hash | token_hash | BTREE | Token redemption lookup |
| idx_evt_user_id | user_id, status | BTREE | "Get pending tokens for user" |
| idx_evt_expires_at | expires_at, status | BTREE | Expiry cron job |

**Partition strategy**: None. Low volume. TTL-based deletion job clears rows older than 90 days.

**Example row**:
```json
{
  "id": "clxevt001",
  "user_id": "clx9abc123def",
  "token_hash": "e3b0c44298fc1c149afb...",
  "email": "alex@example.com",
  "type": "email_verification",
  "status": "used",
  "created_at": "2026-01-15T09:58:10Z",
  "expires_at": "2026-01-16T09:58:10Z",
  "used_at": "2026-01-15T10:00:00Z",
  "delivery_status": "sent",
  "delivery_sent_at": "2026-01-15T09:58:12Z",
  "resend_count": 0
}
```

**Developer notes**: Raw tokens are generated server-side, sent in email, then immediately hashed before storage. On redemption, hash the incoming token and compare — never compare raw strings. `attempt_count` gates brute-force: lock token after 5 failed attempts.

---

### PASSWORD_RESET_TOKENS

**Purpose**: Secure single-use tokens for password reset flows, with suspicious-pattern detection fields.

**Write frequency**: Low — created on reset request
**Read frequency**: Low — on token redemption only
**Retention**: 7 days — very short; tokens expire in 1 hour anyway
**PII**: YES — `email`, `request_ip`, `used_ip`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxprt001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | token_hash | TEXT | NO | — | SHA-256 of the raw reset token | 7c4a8d09ca... |
| 4 | email | TEXT | NO | — | Email that requested the reset **(PII)** | alex@example.com |
| 5 | status | TEXT | NO | 'pending' | pending / used / expired / cancelled | pending |
| 6 | created_at | TIMESTAMPTZ | NO | now() | When token was created | 2026-04-18T08:00:00Z |
| 7 | expires_at | TIMESTAMPTZ | NO | — | 1 hour from created_at | 2026-04-18T09:00:00Z |
| 8 | used_at | TIMESTAMPTZ | YES | NULL | When password was successfully reset | NULL |
| 9 | used_ip | INET | YES | NULL | IP that completed the reset **(PII)** | NULL |
| 10 | used_user_agent | TEXT | YES | NULL | UA at time of reset completion | NULL |
| 11 | request_ip | INET | NO | — | IP that initiated the reset request **(PII)** | 192.168.1.1 |
| 12 | request_user_agent | TEXT | YES | NULL | UA at request time | Mozilla/5.0... |
| 13 | reset_count_24h | SMALLINT | NO | 0 | How many resets were requested for this account in last 24h | 1 |
| 14 | suspicious_flag | BOOLEAN | NO | false | True if request looks anomalous | false |
| 15 | suspicious_reason | TEXT | YES | NULL | Reason for flag: ip_mismatch, high_frequency, tor_exit | NULL |
| 16 | metadata | JSONB | NO | '{}' | Provider message ID, etc. | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (token_hash)
FK: user_id → USERS.id ON DELETE CASCADE
CHECK (status IN ('pending','used','expired','cancelled'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_prt_token_hash | token_hash | BTREE | Token redemption |
| idx_prt_user_status | user_id, status, created_at | BTREE | Recent tokens per user |
| idx_prt_expires_at | expires_at, status | BTREE | Expiry cron job |

**Partition strategy**: None. TTL deletion job clears rows older than 7 days.

**Example row**:
```json
{
  "id": "clxprt001",
  "user_id": "clx9abc123def",
  "token_hash": "7c4a8d09ca3762af...",
  "email": "alex@example.com",
  "status": "pending",
  "created_at": "2026-04-18T08:00:00Z",
  "expires_at": "2026-04-18T09:00:00Z",
  "request_ip": "192.168.1.1",
  "reset_count_24h": 1,
  "suspicious_flag": false
}
```

**Developer notes**: `reset_count_24h` is denormalized at write time by counting recent rows for the same `user_id` before insert. Flag as suspicious if `reset_count_24h > 3` or if `request_ip` differs dramatically from `USERS.last_known_ip`. Alert security team if `suspicious_flag = true` AND `used_at IS NOT NULL` (suspicious reset was completed).

---

### USER_SESSIONS

**Purpose**: Every browser session ever opened — device context, duration, activity summary, and security signals.

**Write frequency**: Medium — created on login, updated on activity, closed on logout/expiry
**Read frequency**: High — session validation on every authenticated request (use Redis cache)
**Retention**: 2 years — needed for security investigations and user activity history
**PII**: YES — `ip_address`, `ip_city`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxses001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | device_id | TEXT | YES | NULL | FK → USER_DEVICES | clxdev321 |
| 4 | session_token_hash | TEXT | NO | — | SHA-256 of the session token stored in cookie | 9f86d081... |
| 5 | started_at | TIMESTAMPTZ | NO | now() | Session creation time | 2026-04-18T08:00:00Z |
| 6 | ended_at | TIMESTAMPTZ | YES | NULL | Session close time | NULL |
| 7 | last_active_at | TIMESTAMPTZ | NO | now() | Last recorded activity within session | 2026-04-18T09:30:00Z |
| 8 | duration_seconds | INTEGER | YES | NULL | Populated on session end | NULL |
| 9 | ended_reason | TEXT | YES | NULL | logout / expired / revoked / timeout / unknown | NULL |
| 10 | ip_address | INET | NO | — | IP at session start **(PII)** | 192.168.1.1 |
| 11 | ip_country | TEXT | YES | NULL | Country from IP geo lookup | US |
| 12 | ip_city | TEXT | YES | NULL | City from IP geo (approximate) **(PII)** | San Francisco |
| 13 | user_agent | TEXT | YES | NULL | Full User-Agent string | Mozilla/5.0... |
| 14 | browser | TEXT | YES | NULL | Parsed browser name | Chrome |
| 15 | browser_version | TEXT | YES | NULL | Parsed browser version | 124.0.0.0 |
| 16 | os | TEXT | YES | NULL | Parsed OS | macOS |
| 17 | os_version | TEXT | YES | NULL | Parsed OS version | 15.3 |
| 18 | device_type | TEXT | YES | NULL | desktop / mobile / tablet | desktop |
| 19 | is_extension_active | BOOLEAN | NO | false | Extension was detected in this session | true |
| 20 | extension_version | TEXT | YES | NULL | Extension version at session start | 1.4.2 |
| 21 | rooms_visited | SMALLINT | NO | 0 | Rooms entered during this session | 2 |
| 22 | videos_watched | SMALLINT | NO | 0 | Videos watched during session | 3 |
| 23 | messages_sent | INTEGER | NO | 0 | Messages sent during session | 24 |
| 24 | reactions_sent | SMALLINT | NO | 0 | Reactions sent during session | 7 |
| 25 | total_watch_time_seconds | INTEGER | NO | 0 | Watch time accumulated in this session | 5400 |
| 26 | tab_focus_count | SMALLINT | NO | 0 | Times user returned focus to the YouTube tab | 4 |
| 27 | tab_blur_count | SMALLINT | NO | 0 | Times user left the YouTube tab | 4 |
| 28 | total_background_time_seconds | INTEGER | NO | 0 | Total seconds tab was not in focus | 300 |
| 29 | ws_connection_count | SMALLINT | NO | 0 | WS connections opened in this session | 1 |
| 30 | ws_disconnection_count | SMALLINT | NO | 0 | WS disconnections in this session | 0 |
| 31 | total_ws_downtime_seconds | INTEGER | NO | 0 | Total seconds WS was disconnected | 0 |
| 32 | auth_method | TEXT | NO | — | How this session was created: email_password / google_oauth / session_refresh | email_password |
| 33 | is_suspicious | BOOLEAN | NO | false | Flagged by risk engine | false |
| 34 | suspicious_reason | TEXT | YES | NULL | Reason for suspicious flag | NULL |
| 35 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (session_token_hash)
FK: user_id → USERS.id ON DELETE CASCADE
FK: device_id → USER_DEVICES.id ON DELETE SET NULL
CHECK (ended_reason IN ('logout','expired','revoked','timeout','unknown') OR ended_reason IS NULL)
CHECK (auth_method IN ('email_password','google_oauth','session_refresh'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_sessions_token | session_token_hash | BTREE | Session validation |
| idx_sessions_user | user_id, started_at DESC | BTREE | User session history |
| idx_sessions_active | user_id, ended_at | BTREE | Find active sessions for user |
| idx_sessions_device | device_id | BTREE | Sessions per device |

**Partition strategy**: RANGE by `started_at`, monthly. Archive partitions older than 2 years to cold storage.

**Example row**:
```json
{
  "id": "clxses001",
  "user_id": "clx9abc123def",
  "session_token_hash": "9f86d081884c7d659...",
  "started_at": "2026-04-18T08:00:00Z",
  "last_active_at": "2026-04-18T09:30:00Z",
  "ip_address": "192.168.1.1",
  "ip_country": "US",
  "browser": "Chrome",
  "browser_version": "124.0.0.0",
  "os": "macOS",
  "device_type": "desktop",
  "is_extension_active": true,
  "extension_version": "1.4.2",
  "rooms_visited": 2,
  "auth_method": "email_password"
}
```

**Developer notes**: Active session lookup goes through Redis (key: `session:{token_hash}`). PostgreSQL row is written on create and updated on end. Do not update `last_active_at` on every request — batch updates every 60 seconds to avoid write amplification. Session counters (`rooms_visited`, `messages_sent`, etc.) are updated on session close in a single UPDATE.

---

### LOGIN_ATTEMPTS

**Purpose**: Immutable log of every login attempt for security monitoring, brute-force detection, and credential-stuffing detection.

**Write frequency**: Medium — every login attempt (success or failure)
**Read frequency**: Low — security dashboards, anomaly detection jobs, incident response
**Retention**: 1 year — needed for security investigations; PII-scrub after 90 days optional
**PII**: YES — `email`, `ip_address`, `ip_city`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxlat001 |
| 2 | user_id | TEXT | YES | NULL | FK → USERS; NULL if email not found | clx9abc123def |
| 3 | email | TEXT | NO | — | Email used in attempt **(PII)** | alex@example.com |
| 4 | email_hash | TEXT | NO | — | SHA-256 of email for safe analytics | a9b4c3... |
| 5 | auth_method | TEXT | NO | — | email_password / google_oauth | email_password |
| 6 | attempted_at | TIMESTAMPTZ | NO | now() | Attempt timestamp | 2026-04-18T08:00:00Z |
| 7 | success | BOOLEAN | NO | — | Whether login succeeded | false |
| 8 | failure_reason | TEXT | YES | NULL | invalid_password / user_not_found / email_not_verified / account_suspended / too_many_attempts / oauth_error | invalid_password |
| 9 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS; populated on success | NULL |
| 10 | ip_address | INET | NO | — | Client IP **(PII)** | 192.168.1.1 |
| 11 | ip_country | TEXT | YES | NULL | Country from geo lookup | US |
| 12 | ip_city | TEXT | YES | NULL | City (approximate) **(PII)** | San Francisco |
| 13 | user_agent | TEXT | YES | NULL | Full User-Agent | Mozilla/5.0... |
| 14 | browser | TEXT | YES | NULL | Parsed browser | Chrome |
| 15 | browser_version | TEXT | YES | NULL | Parsed version | 124.0.0.0 |
| 16 | os | TEXT | YES | NULL | Parsed OS | macOS |
| 17 | device_fingerprint | TEXT | YES | NULL | Hashed device fingerprint | 3f4a9b... |
| 18 | device_id | TEXT | YES | NULL | FK → USER_DEVICES (if recognized device) | NULL |
| 19 | is_tor_exit | BOOLEAN | NO | false | IP is a known Tor exit node | false |
| 20 | is_vpn | BOOLEAN | NO | false | IP detected as VPN | false |
| 21 | is_datacenter_ip | BOOLEAN | NO | false | IP is a datacenter/cloud range | false |
| 22 | risk_score | SMALLINT | NO | 0 | 0–100 computed risk score | 15 |
| 23 | risk_signals | JSONB | NO | '[]' | Array of triggered risk signal names | ["new_device","new_country"] |
| 24 | attempts_in_last_hour | SMALLINT | NO | 0 | Failed attempts for this email in last 60 min | 1 |
| 25 | attempts_in_last_day | SMALLINT | NO | 0 | Failed attempts for this email in last 24h | 2 |
| 26 | brute_force_flag | BOOLEAN | NO | false | Triggered brute-force threshold | false |
| 27 | credential_stuffing_flag | BOOLEAN | NO | false | Same IP trying many accounts | false |
| 28 | metadata | JSONB | NO | '{}' | OAuth error details, etc. | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE SET NULL   — keep log even if user deleted
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
FK: device_id → USER_DEVICES.id ON DELETE SET NULL
CHECK (auth_method IN ('email_password','google_oauth'))
CHECK (risk_score BETWEEN 0 AND 100)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_lat_attempted_at | attempted_at DESC | BTREE | Time-range security queries |
| idx_lat_email_hash | email_hash, attempted_at | BTREE | Per-account brute force check |
| idx_lat_ip | ip_address, attempted_at | BTREE | Per-IP credential stuffing check |
| idx_lat_user | user_id, attempted_at | BTREE | Account history |
| idx_lat_flags | brute_force_flag, credential_stuffing_flag | BTREE | Alert dashboard |

**Partition strategy**: RANGE by `attempted_at`, monthly.

**Example row**:
```json
{
  "id": "clxlat001",
  "email_hash": "a9b4c3d2...",
  "auth_method": "email_password",
  "attempted_at": "2026-04-18T08:00:00Z",
  "success": false,
  "failure_reason": "invalid_password",
  "ip_country": "US",
  "risk_score": 15,
  "risk_signals": ["new_device"],
  "attempts_in_last_hour": 1,
  "brute_force_flag": false
}
```

**Developer notes**: Never update rows in this table. `attempts_in_last_hour` and `attempts_in_last_day` are computed and denormalized at write time by querying recent rows — enables fast rate-limit decisions without aggregating on hot read path. Consider scrubbing raw `email` and `ip_address` after 90 days while retaining hashes.

---

### OAUTH_CONNECTIONS

**Purpose**: Google OAuth connection metadata per user — token state, scopes, profile data synced, refresh health.

**Write frequency**: Low — on OAuth connect, token refresh, and disconnect
**Read frequency**: Medium — on OAuth login flows and token refresh checks
**Retention**: Forever while connected; keep 1 year after disconnect for audit
**PII**: YES — `provider_user_id`, `provider_email`, `profile_name`, `profile_avatar_url`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxoac001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | provider | TEXT | NO | — | google (extensible for future providers) | google |
| 4 | provider_user_id | TEXT | NO | — | Provider's user identifier (`sub` for Google) **(PII)** | 109876543210987654321 |
| 5 | provider_email | TEXT | NO | — | Email from OAuth provider **(PII)** | alex@gmail.com |
| 6 | provider_email_verified | BOOLEAN | NO | false | Whether provider confirmed email | true |
| 7 | access_token_hash | TEXT | YES | NULL | SHA-256 of access token (never raw) | 4c6f37... |
| 8 | refresh_token_hash | TEXT | YES | NULL | SHA-256 of refresh token | 9d4a12... |
| 9 | access_token_expires_at | TIMESTAMPTZ | YES | NULL | When current access token expires | 2026-04-18T09:00:00Z |
| 10 | refresh_token_expires_at | TIMESTAMPTZ | YES | NULL | When refresh token expires (Google: no expiry unless revoked) | NULL |
| 11 | scopes_granted | TEXT[] | NO | '{}' | OAuth scopes granted by user | {openid,email,profile} |
| 12 | profile_name | TEXT | YES | NULL | Display name from OAuth profile **(PII)** | Alex Chen |
| 13 | profile_avatar_url | TEXT | YES | NULL | Avatar URL from OAuth provider **(PII)** | https://lh3.google.com/... |
| 14 | profile_locale | TEXT | YES | NULL | Locale from OAuth profile | en |
| 15 | connected_at | TIMESTAMPTZ | NO | now() | When OAuth was first connected | 2026-01-15T09:58:00Z |
| 16 | disconnected_at | TIMESTAMPTZ | YES | NULL | When OAuth was disconnected | NULL |
| 17 | last_refreshed_at | TIMESTAMPTZ | YES | NULL | Most recent token refresh | 2026-04-18T08:00:00Z |
| 18 | refresh_count | INTEGER | NO | 0 | Lifetime refresh operations | 120 |
| 19 | refresh_failed_count | SMALLINT | NO | 0 | Consecutive refresh failures | 0 |
| 20 | last_refresh_error | TEXT | YES | NULL | Error from most recent failed refresh | NULL |
| 21 | last_refresh_error_at | TIMESTAMPTZ | YES | NULL | When last refresh error occurred | NULL |
| 22 | is_active | BOOLEAN | NO | true | False if disconnected or revoked | true |
| 23 | metadata | JSONB | NO | '{}' | Raw profile claims snapshot | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (provider, provider_user_id)   — one account per provider identity
UNIQUE (user_id, provider)            — one connection per provider per user
FK: user_id → USERS.id ON DELETE CASCADE
CHECK (provider IN ('google'))        — extend as needed
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_oac_user | user_id, provider | BTREE | User's OAuth connections |
| idx_oac_provider_uid | provider, provider_user_id | BTREE | OAuth login lookup |
| idx_oac_refresh_due | is_active, access_token_expires_at | BTREE | Proactive refresh job |

**Partition strategy**: None. Low volume.

**Example row**:
```json
{
  "id": "clxoac001",
  "user_id": "clx9abc123def",
  "provider": "google",
  "provider_user_id": "109876543210987654321",
  "provider_email": "alex@gmail.com",
  "provider_email_verified": true,
  "scopes_granted": ["openid", "email", "profile"],
  "profile_name": "Alex Chen",
  "connected_at": "2026-01-15T09:58:00Z",
  "refresh_count": 120,
  "is_active": true
}
```

**Developer notes**: Actual OAuth tokens are stored in an encrypted secret store (e.g., Vault or AWS Secrets Manager) referenced by ID — never persist raw tokens in PostgreSQL. The `*_token_hash` fields here are for audit purposes only (detecting if a token changed). `refresh_failed_count` resets to 0 on success; alert at 3 consecutive failures.

---

### USER_DEVICES

**Purpose**: Every unique device that has ever accessed any account — trust level, extension state, first/last seen, and revocation history.

**Write frequency**: Low — on new device detection, trust level change, extension update
**Read frequency**: Medium — on login (device recognition), security checks
**Retention**: 3 years from `last_seen_at`
**PII**: YES — `last_seen_ip`, `last_seen_city`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxdev321 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | fingerprint_hash | TEXT | NO | — | Hashed device fingerprint (browser, OS, screen, fonts hash) | 3f4a9b... |
| 4 | device_type | TEXT | YES | NULL | desktop / mobile / tablet | desktop |
| 5 | os | TEXT | YES | NULL | Detected OS | macOS |
| 6 | os_version | TEXT | YES | NULL | OS version | 15.3 |
| 7 | browser | TEXT | YES | NULL | Browser name | Chrome |
| 8 | browser_version | TEXT | YES | NULL | Browser version | 124.0.0.0 |
| 9 | screen_resolution | TEXT | YES | NULL | e.g. 2560x1440 | 2560x1440 |
| 10 | timezone | TEXT | YES | NULL | IANA timezone from browser | America/New_York |
| 11 | language | TEXT | YES | NULL | Browser language | en-US |
| 12 | trust_level | TEXT | NO | 'new' | trusted / known / new / suspicious / blocked | known |
| 13 | trusted_at | TIMESTAMPTZ | YES | NULL | When user explicitly trusted this device | NULL |
| 14 | first_seen_at | TIMESTAMPTZ | NO | now() | First access from this device | 2026-01-15T09:58:00Z |
| 15 | last_seen_at | TIMESTAMPTZ | NO | now() | Most recent access | 2026-04-18T08:00:00Z |
| 16 | last_seen_ip | INET | YES | NULL | Last known IP for this device **(PII)** | 192.168.1.1 |
| 17 | last_seen_country | TEXT | YES | NULL | Country from last_seen_ip | US |
| 18 | last_seen_city | TEXT | YES | NULL | City (approximate) **(PII)** | San Francisco |
| 19 | extension_installed | BOOLEAN | NO | false | Extension detected on this device | true |
| 20 | extension_version | TEXT | YES | NULL | Current extension version on device | 1.4.2 |
| 21 | extension_first_installed_at | TIMESTAMPTZ | YES | NULL | First time extension detected | 2026-01-15T10:05:00Z |
| 22 | extension_last_active_at | TIMESTAMPTZ | YES | NULL | Last time extension was active | 2026-04-18T08:00:00Z |
| 23 | session_count | INTEGER | NO | 0 | Total sessions from this device | 47 |
| 24 | login_count | INTEGER | NO | 0 | Total logins from this device | 47 |
| 25 | device_name | TEXT | YES | NULL | User-assigned friendly name | MacBook Pro |
| 26 | is_revoked | BOOLEAN | NO | false | User revoked this device's access | false |
| 27 | revoked_at | TIMESTAMPTZ | YES | NULL | Revocation timestamp | NULL |
| 28 | revocation_reason | TEXT | YES | NULL | lost / stolen / other | NULL |
| 29 | metadata | JSONB | NO | '{}' | Raw fingerprint components (hashed) | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (user_id, fingerprint_hash)    — one record per device per user
FK: user_id → USERS.id ON DELETE CASCADE
CHECK (trust_level IN ('trusted','known','new','suspicious','blocked'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_devices_user | user_id, last_seen_at DESC | BTREE | User device list |
| idx_devices_fingerprint | fingerprint_hash | BTREE | Device recognition on login |
| idx_devices_extension | extension_installed, extension_last_active_at | BTREE | Extension adoption analytics |
| idx_devices_revoked | user_id, is_revoked | BTREE | Active device checks |

**Partition strategy**: None. Row count bounded by `users × avg_devices_per_user`.

**Example row**:
```json
{
  "id": "clxdev321",
  "user_id": "clx9abc123def",
  "fingerprint_hash": "3f4a9b7c...",
  "device_type": "desktop",
  "os": "macOS",
  "browser": "Chrome",
  "browser_version": "124.0.0.0",
  "trust_level": "known",
  "first_seen_at": "2026-01-15T09:58:00Z",
  "last_seen_at": "2026-04-18T08:00:00Z",
  "extension_installed": true,
  "extension_version": "1.4.2",
  "session_count": 47
}
```

**Developer notes**: Fingerprint is computed client-side from browser properties (UA, screen resolution, timezone, language, installed fonts hash, canvas fingerprint) and hashed before sending to server. Never store raw fingerprint components. On login, compute fingerprint and look up by `(user_id, fingerprint_hash)` — if not found, create new device record and send "new device" security email.

---

## Group 2 — Room and Membership

---

### ROOMS

**Purpose**: Every watch party room ever created — configuration, state, platform context, quality metrics, and lifecycle.

**Write frequency**: Low — created once, updated on member join/leave, video change, and room end
**Read frequency**: High — room state checked on every sync event and member action
**Retention**: Forever (rooms are part of user history and analytics)
**PII**: NO — no direct PII (member user_ids are in ROOM_MEMBERS)

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxroom001 |
| 2 | code | TEXT | NO | — | 6-char human-readable join code (uppercase) | XK7P2Q |
| 3 | host_user_id | TEXT | NO | — | FK → USERS; original host | clx9abc123def |
| 4 | name | TEXT | YES | NULL | Optional room display name | Movie Night 🎬 |
| 5 | description | TEXT | YES | NULL | Optional room description | Watching Interstellar together |
| 6 | status | TEXT | NO | 'waiting' | waiting / active / paused / ended / abandoned | active |
| 7 | privacy | TEXT | NO | 'private' | public / private / invite_only | invite_only |
| 8 | created_at | TIMESTAMPTZ | NO | now() | Room creation time | 2026-04-18T08:00:00Z |
| 9 | started_at | TIMESTAMPTZ | YES | NULL | When first video started playing | 2026-04-18T08:05:00Z |
| 10 | ended_at | TIMESTAMPTZ | YES | NULL | When room was closed | NULL |
| 11 | last_active_at | TIMESTAMPTZ | NO | now() | Last activity timestamp | 2026-04-18T09:30:00Z |
| 12 | max_members | SMALLINT | NO | 10 | Member cap for this room | 10 |
| 13 | current_member_count | SMALLINT | NO | 0 | Active member count (denormalized) | 4 |
| 14 | peak_member_count | SMALLINT | NO | 0 | Maximum simultaneous members ever | 6 |
| 15 | total_members_ever | SMALLINT | NO | 0 | Total unique members who ever joined | 8 |
| 16 | platform | TEXT | NO | 'youtube' | youtube / netflix / prime / disney_plus / unknown | youtube |
| 17 | platform_room_url | TEXT | YES | NULL | Full URL of the page (sanitized) | https://youtube.com/watch?v=... |
| 18 | current_video_id | TEXT | YES | NULL | FK → ROOM_VIDEOS | clxrvid001 |
| 19 | total_videos_watched | SMALLINT | NO | 0 | Count of videos played in this room | 2 |
| 20 | total_messages | INTEGER | NO | 0 | Total messages sent (denormalized) | 147 |
| 21 | total_reactions | INTEGER | NO | 0 | Total reactions (video + message) | 52 |
| 22 | total_sync_events | INTEGER | NO | 0 | Total sync events in this room | 23 |
| 23 | average_sync_drift_ms | REAL | YES | NULL | Running average of sync drift | 180.5 |
| 24 | max_sync_drift_ms | REAL | YES | NULL | Worst observed sync drift | 2400.0 |
| 25 | total_watch_time_seconds | INTEGER | NO | 0 | Sum of all member watch times | 43200 |
| 26 | call_enabled | BOOLEAN | NO | false | Whether call feature is on for this room | true |
| 27 | call_session_id | TEXT | YES | NULL | FK → CALL_SESSIONS; current active call | clxcall001 |
| 28 | call_participant_count | SMALLINT | NO | 0 | Current call participants (denormalized) | 3 |
| 29 | password_protected | BOOLEAN | NO | false | Whether room requires a password | false |
| 30 | password_hash | TEXT | YES | NULL | Argon2id hash of room password | NULL |
| 31 | geographic_distribution | JSONB | NO | '{}' | Map of {country_code: member_count} | {"US":3,"IN":1} |
| 32 | member_limit_reached_count | SMALLINT | NO | 0 | Times max_members cap was hit | 0 |
| 33 | end_reason | TEXT | YES | NULL | host_ended / all_members_left / inactivity / admin_closed | NULL |
| 34 | closed_by_admin_user_id | TEXT | YES | NULL | FK → USERS; admin who force-closed | NULL |
| 35 | closed_reason | TEXT | YES | NULL | Admin note for forced close | NULL |
| 36 | is_featured | BOOLEAN | NO | false | Flagged for marketing/discovery pages | false |
| 37 | tags | TEXT[] | NO | '{}' | Content tags for discovery | {movies,sci-fi} |
| 38 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (code)    — globally unique join codes
FK: host_user_id → USERS.id ON DELETE RESTRICT    — cannot delete user with rooms
FK: current_video_id → ROOM_VIDEOS.id ON DELETE SET NULL
FK: call_session_id → CALL_SESSIONS.id ON DELETE SET NULL
FK: closed_by_admin_user_id → USERS.id ON DELETE SET NULL
CHECK (status IN ('waiting','active','paused','ended','abandoned'))
CHECK (privacy IN ('public','private','invite_only'))
CHECK (platform IN ('youtube','netflix','prime','disney_plus','unknown'))
CHECK (max_members BETWEEN 2 AND 50)
CHECK (current_member_count >= 0 AND current_member_count <= max_members)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_rooms_code | code | BTREE | Join by code lookup |
| idx_rooms_host | host_user_id, created_at DESC | BTREE | Host's room history |
| idx_rooms_status | status, last_active_at | BTREE | Active room monitoring |
| idx_rooms_platform | platform, created_at | BTREE | Platform analytics |
| idx_rooms_created | created_at DESC | BTREE | Growth dashboards |

**Partition strategy**: None at 1M users; room count stays manageable. Re-evaluate at 10M users — RANGE by `created_at` yearly.

**Example row**:
```json
{
  "id": "clxroom001",
  "code": "XK7P2Q",
  "host_user_id": "clx9abc123def",
  "name": "Movie Night",
  "status": "active",
  "privacy": "invite_only",
  "platform": "youtube",
  "max_members": 10,
  "current_member_count": 4,
  "peak_member_count": 6,
  "total_messages": 147,
  "average_sync_drift_ms": 180.5,
  "call_enabled": true,
  "created_at": "2026-04-18T08:00:00Z"
}
```

**Developer notes**: `current_member_count` and `call_participant_count` are maintained in the same transaction as ROOM_MEMBERS writes. Never compute them via COUNT on hot paths. `geographic_distribution` is updated when a member joins — merge the JSONB key. `platform_room_url` should strip query params that could contain auth tokens before storage.

---

### ROOM_MEMBERS

**Purpose**: Every membership event in every room — join method, role, engagement metrics, experience quality, and exit state.

**Write frequency**: Medium — on join, leave, message send, reaction (counter updates), and room end
**Read frequency**: High — room state, member list, analytics
**Retention**: Forever — core engagement data
**PII**: NO — user identity via FK, no raw PII columns

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxrmem001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 4 | role | TEXT | NO | 'member' | host / co_host / member | member |
| 5 | status | TEXT | NO | 'active' | active / left / removed / banned | active |
| 6 | join_method | TEXT | NO | — | invite_link / invite_code / direct_link / host / co_host_invite | invite_link |
| 7 | invite_token_id | TEXT | YES | NULL | FK → INVITE_TOKENS | clxinv789 |
| 8 | joined_at | TIMESTAMPTZ | NO | now() | When member joined | 2026-04-18T08:05:00Z |
| 9 | left_at | TIMESTAMPTZ | YES | NULL | When member left voluntarily | NULL |
| 10 | removed_at | TIMESTAMPTZ | YES | NULL | When member was removed by host/admin | NULL |
| 11 | removed_by_user_id | TEXT | YES | NULL | FK → USERS; who removed this member | NULL |
| 12 | removal_reason | TEXT | YES | NULL | Host-provided reason | NULL |
| 13 | banned_at | TIMESTAMPTZ | YES | NULL | When ban was applied | NULL |
| 14 | banned_by_user_id | TEXT | YES | NULL | FK → USERS | NULL |
| 15 | ban_reason | TEXT | YES | NULL | Ban reason | NULL |
| 16 | ban_expires_at | TIMESTAMPTZ | YES | NULL | NULL = permanent ban | NULL |
| 17 | total_watch_time_seconds | INTEGER | NO | 0 | Watch time in this room | 5400 |
| 18 | messages_sent | INTEGER | NO | 0 | Messages sent in this room | 24 |
| 19 | reactions_sent | SMALLINT | NO | 0 | Reactions sent in this room | 7 |
| 20 | video_interactions | INTEGER | NO | 0 | Player interactions while in this room | 15 |
| 21 | sync_contributions | SMALLINT | NO | 0 | Times this user triggered a sync event | 3 |
| 22 | call_joined | BOOLEAN | NO | false | Whether this member ever joined the call | true |
| 23 | call_join_time | TIMESTAMPTZ | YES | NULL | First call join time | 2026-04-18T08:06:00Z |
| 24 | call_leave_time | TIMESTAMPTZ | YES | NULL | Last call leave time | NULL |
| 25 | call_duration_seconds | INTEGER | NO | 0 | Total call participation time | 3600 |
| 26 | buffer_events_count | SMALLINT | NO | 0 | Number of buffer events experienced | 2 |
| 27 | average_sync_drift_ms | REAL | YES | NULL | This member's average drift | 120.0 |
| 28 | max_sync_drift_ms | REAL | YES | NULL | Worst drift experienced | 800.0 |
| 29 | stayed_till_end | BOOLEAN | YES | NULL | NULL until room ends, then set | NULL |
| 30 | first_video_position_on_join | REAL | YES | NULL | Video position (seconds) when member joined | 120.5 |
| 31 | last_video_position | REAL | YES | NULL | Last known video position | 5400.0 |
| 32 | completion_rate | REAL | YES | NULL | Fraction of video watched (0.0–1.0) | 0.85 |
| 33 | experience_quality_score | SMALLINT | YES | NULL | 0–100 computed (drift + buffers + call quality) | 87 |
| 34 | is_first_room | BOOLEAN | NO | false | Was this their first ever room? | false |
| 35 | device_id | TEXT | YES | NULL | FK → USER_DEVICES | clxdev321 |
| 36 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 37 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (room_id, user_id)    — one membership record per user per room
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: user_id → USERS.id ON DELETE RESTRICT
FK: invite_token_id → INVITE_TOKENS.id ON DELETE SET NULL
FK: removed_by_user_id → USERS.id ON DELETE SET NULL
FK: banned_by_user_id → USERS.id ON DELETE SET NULL
FK: device_id → USER_DEVICES.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (role IN ('host','co_host','member'))
CHECK (status IN ('active','left','removed','banned'))
CHECK (completion_rate IS NULL OR completion_rate BETWEEN 0 AND 1)
CHECK (experience_quality_score IS NULL OR experience_quality_score BETWEEN 0 AND 100)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_rmem_room | room_id, status | BTREE | Active members in room |
| idx_rmem_user | user_id, joined_at DESC | BTREE | User room history |
| idx_rmem_room_user | room_id, user_id | BTREE | Membership lookup |
| idx_rmem_invite | invite_token_id | BTREE | Invite conversion tracking |
| idx_rmem_joined_at | joined_at DESC | BTREE | Recent joins dashboard |

**Partition strategy**: RANGE by `joined_at`, monthly. Archive after 2 years.

**Example row**:
```json
{
  "id": "clxrmem001",
  "room_id": "clxroom001",
  "user_id": "clxuser999",
  "role": "member",
  "status": "active",
  "join_method": "invite_link",
  "joined_at": "2026-04-18T08:05:00Z",
  "total_watch_time_seconds": 5400,
  "messages_sent": 24,
  "call_joined": true,
  "average_sync_drift_ms": 120.0,
  "is_first_room": false
}
```

**Developer notes**: Counter columns (`messages_sent`, `reactions_sent`, `video_interactions`) are incremented in application code in the same transaction as the source event. `stayed_till_end` is set via a batch job when `ROOMS.status` changes to `ended`. `experience_quality_score` is computed nightly.

---

### INVITE_TOKENS

**Purpose**: Full lifecycle of every invite link and code — creation, distribution, usage, expiry, and conversion tracking.

**Write frequency**: Low — on invite creation, use, and revocation
**Read frequency**: Medium — on every room join attempt
**Retention**: 1 year after expiry/use
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxinv789 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | created_by_user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 4 | token | TEXT | NO | — | Full URL token (32-char random hex) | 7f3d9a1b4c... |
| 5 | token_type | TEXT | NO | — | link / code | link |
| 6 | code | TEXT | YES | NULL | 6-char readable code (for code type) | XK7P2Q |
| 7 | status | TEXT | NO | 'active' | active / used / expired / revoked / max_uses_reached | active |
| 8 | max_uses | SMALLINT | YES | NULL | NULL = unlimited | NULL |
| 9 | use_count | SMALLINT | NO | 0 | How many times this token has been used | 3 |
| 10 | expires_at | TIMESTAMPTZ | YES | NULL | NULL = never expires | NULL |
| 11 | created_at | TIMESTAMPTZ | NO | now() | Creation timestamp | 2026-04-18T08:01:00Z |
| 12 | first_used_at | TIMESTAMPTZ | YES | NULL | First redemption time | 2026-04-18T08:05:00Z |
| 13 | last_used_at | TIMESTAMPTZ | YES | NULL | Most recent redemption time | 2026-04-18T08:10:00Z |
| 14 | revoked_at | TIMESTAMPTZ | YES | NULL | Revocation timestamp | NULL |
| 15 | revoked_by_user_id | TEXT | YES | NULL | FK → USERS | NULL |
| 16 | revocation_reason | TEXT | YES | NULL | Why revoked | NULL |
| 17 | conversion_count | SMALLINT | NO | 0 | Uses that led to active users (updated async) | 2 |
| 18 | role_granted | TEXT | NO | 'member' | Role new member gets: member / co_host | member |
| 19 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (token)
UNIQUE (code) WHERE code IS NOT NULL
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: created_by_user_id → USERS.id ON DELETE RESTRICT
FK: revoked_by_user_id → USERS.id ON DELETE SET NULL
CHECK (status IN ('active','used','expired','revoked','max_uses_reached'))
CHECK (token_type IN ('link','code'))
CHECK (role_granted IN ('member','co_host'))
CHECK (use_count >= 0)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_inv_token | token | BTREE | Token validation on join |
| idx_inv_code | code | BTREE | Code validation on join |
| idx_inv_room | room_id, status | BTREE | Room's active invites |
| idx_inv_creator | created_by_user_id | BTREE | User's invite history |

**Partition strategy**: None. Volume bounded by rooms × invites per room.

**Example row**:
```json
{
  "id": "clxinv789",
  "room_id": "clxroom001",
  "created_by_user_id": "clx9abc123def",
  "token": "7f3d9a1b4c2e5f8a...",
  "token_type": "link",
  "status": "active",
  "use_count": 3,
  "role_granted": "member",
  "created_at": "2026-04-18T08:01:00Z",
  "first_used_at": "2026-04-18T08:05:00Z"
}
```

**Developer notes**: Validate token on join: check status = 'active', check expires_at, check use_count < max_uses. Increment use_count atomically with `UPDATE ... SET use_count = use_count + 1 WHERE id = $1 AND use_count < max_uses`. Race condition possible with unlimited invites — acceptable.

---

### ROOM_MEMBER_ROLE_HISTORY

**Purpose**: Append-only audit log of every role change in every room — who changed it, when, and why.

**Write frequency**: Low — only on role changes
**Read frequency**: Low — audit views, moderation review
**Retention**: Forever — audit record
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxrrh001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | user_id | TEXT | NO | — | FK → USERS; whose role changed | clxuser999 |
| 4 | changed_by_user_id | TEXT | NO | — | FK → USERS; who made the change | clx9abc123def |
| 5 | previous_role | TEXT | NO | — | Role before change | member |
| 6 | new_role | TEXT | NO | — | Role after change | co_host |
| 7 | reason | TEXT | YES | NULL | Optional reason text | Trusted co-watcher |
| 8 | changed_at | TIMESTAMPTZ | NO | now() | When the change occurred | 2026-04-18T08:15:00Z |
| 9 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: user_id → USERS.id ON DELETE RESTRICT
FK: changed_by_user_id → USERS.id ON DELETE RESTRICT
CHECK (previous_role IN ('host','co_host','member'))
CHECK (new_role IN ('host','co_host','member'))
CHECK (previous_role != new_role)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_rrh_room | room_id, changed_at | BTREE | Room role change history |
| idx_rrh_user | user_id, changed_at | BTREE | User role history |

**Partition strategy**: None. Very low volume.

**Example row**:
```json
{
  "id": "clxrrh001",
  "room_id": "clxroom001",
  "user_id": "clxuser999",
  "changed_by_user_id": "clx9abc123def",
  "previous_role": "member",
  "new_role": "co_host",
  "changed_at": "2026-04-18T08:15:00Z"
}
```

**Developer notes**: Never UPDATE or DELETE rows. This is an append-only audit log. The current role is authoritative in ROOM_MEMBERS.role; this table is for history only.

---

## Group 3 — Video and Sync

---

### ROOM_VIDEOS

**Purpose**: Every video ever loaded in any room — full metadata, how it was added, watch completion, and quality metrics.

**Write frequency**: Low — on video load, metadata fetch, and room end
**Read frequency**: High — sync events reference this table constantly
**Retention**: Forever — critical for watch history and content analytics
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxrvid001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | added_by_user_id | TEXT | NO | — | FK → USERS; who loaded the video | clx9abc123def |
| 4 | platform | TEXT | NO | 'youtube' | youtube / netflix / prime / disney_plus | youtube |
| 5 | platform_video_id | TEXT | NO | — | YouTube video ID or equivalent | dQw4w9WgXcQ |
| 6 | video_url | TEXT | YES | NULL | Full URL of video page | https://youtube.com/watch?v=... |
| 7 | title | TEXT | YES | NULL | Video title (from metadata fetch) | Never Gonna Give You Up |
| 8 | channel_name | TEXT | YES | NULL | Channel/creator name | RickAstleyVEVO |
| 9 | channel_id | TEXT | YES | NULL | Platform channel identifier | UCuAXFkgsw1L7xaCfnd5JJOw |
| 10 | thumbnail_url | TEXT | YES | NULL | Video thumbnail URL | https://i.ytimg.com/vi/... |
| 11 | duration_seconds | INTEGER | YES | NULL | Total video duration | 212 |
| 12 | description_snippet | TEXT | YES | NULL | First 500 chars of video description | The official video... |
| 13 | category | TEXT | YES | NULL | Platform content category | Music |
| 14 | tags | TEXT[] | NO | '{}' | Platform video tags | {music,80s,pop} |
| 15 | language | TEXT | YES | NULL | Primary language of video (ISO 639-1) | en |
| 16 | published_at | TIMESTAMPTZ | YES | NULL | When video was originally published | 2009-10-25T00:00:00Z |
| 17 | view_count_at_add | BIGINT | YES | NULL | Platform view count when added to room | 1400000000 |
| 18 | like_count_at_add | INTEGER | YES | NULL | Like count when added | 17000000 |
| 19 | metadata_fetched | BOOLEAN | NO | false | Whether metadata was successfully fetched | true |
| 20 | metadata_fetch_error | TEXT | YES | NULL | Error if fetch failed | NULL |
| 21 | metadata_fetched_at | TIMESTAMPTZ | YES | NULL | When metadata was last fetched | 2026-04-18T08:05:00Z |
| 22 | added_at | TIMESTAMPTZ | NO | now() | When video was added to this room | 2026-04-18T08:05:00Z |
| 23 | started_at | TIMESTAMPTZ | YES | NULL | When playback actually began | 2026-04-18T08:05:10Z |
| 24 | ended_at | TIMESTAMPTZ | YES | NULL | When video playback ended/was changed | NULL |
| 25 | total_watch_time_seconds | INTEGER | NO | 0 | Sum of watch time across all members | 6360 |
| 26 | completion_rate | REAL | YES | NULL | Fraction of video completed by room (0.0–1.0) | 0.92 |
| 27 | member_count_at_start | SMALLINT | YES | NULL | How many members were in room when video started | 4 |
| 28 | is_current | BOOLEAN | NO | false | True if this is currently playing | true |
| 29 | play_count | SMALLINT | NO | 0 | Times play was triggered in this room | 5 |
| 30 | pause_count | SMALLINT | NO | 0 | Times pause was triggered | 3 |
| 31 | seek_count | SMALLINT | NO | 0 | Seek events for this video | 8 |
| 32 | average_watch_position_seconds | REAL | YES | NULL | Average video position across all watch time | 120.5 |
| 33 | max_simultaneous_watchers | SMALLINT | NO | 0 | Peak concurrent members watching | 6 |
| 34 | source | TEXT | NO | 'host_loaded' | host_loaded / queue / recommendation / playlist | host_loaded |
| 35 | position_in_session | SMALLINT | NO | 1 | 1st video, 2nd video, etc. | 1 |
| 36 | metadata | JSONB | NO | '{}' | Raw platform API response | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: added_by_user_id → USERS.id ON DELETE RESTRICT
CHECK (platform IN ('youtube','netflix','prime','disney_plus'))
CHECK (completion_rate IS NULL OR completion_rate BETWEEN 0 AND 1)
CHECK (source IN ('host_loaded','queue','recommendation','playlist'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_rvid_room | room_id, added_at | BTREE | Room's video history |
| idx_rvid_platform_vid | platform, platform_video_id | BTREE | "How many rooms watched this video?" |
| idx_rvid_current | room_id, is_current | BTREE | Get current video for room |
| idx_rvid_added_by | added_by_user_id | BTREE | Videos loaded by user |

**Partition strategy**: None. Volume bounded by rooms × videos per session.

**Example row**:
```json
{
  "id": "clxrvid001",
  "room_id": "clxroom001",
  "added_by_user_id": "clx9abc123def",
  "platform": "youtube",
  "platform_video_id": "dQw4w9WgXcQ",
  "title": "Never Gonna Give You Up",
  "channel_name": "RickAstleyVEVO",
  "duration_seconds": 212,
  "metadata_fetched": true,
  "is_current": true,
  "completion_rate": 0.92,
  "play_count": 5,
  "pause_count": 3,
  "added_at": "2026-04-18T08:05:00Z"
}
```

**Developer notes**: `platform_video_id` + `platform` does NOT uniquely identify a row — the same video can be watched in the same room multiple times (ROOM_VIDEOS has one row per load event, not one per unique video). Query `WHERE room_id = $1 AND is_current = true` to get now-playing. `video_url` should have query params sanitized — strip any OAuth tokens before storage.

---

### SYNC_EVENTS

**Purpose**: Every single sync event — the core product data. Play, pause, seek, speed, and quality changes with full timing and broadcast metrics.

**Write frequency**: Very high — every player state change by any member in any active room
**Read frequency**: Medium — playback of events for debugging, quality dashboards
**Retention**: 6 months active; archive to columnar store (e.g., BigQuery/ClickHouse) after 6 months
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxsev001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | room_video_id | TEXT | NO | — | FK → ROOM_VIDEOS | clxrvid001 |
| 4 | triggered_by_user_id | TEXT | YES | NULL | FK → USERS; NULL for system corrections | clx9abc123def |
| 5 | event_type | TEXT | NO | — | play / pause / seek / speed_change / video_change / quality_change / correction | play |
| 6 | server_timestamp | TIMESTAMPTZ | NO | now() | When server received the event | 2026-04-18T08:10:00.123Z |
| 7 | client_timestamp | TIMESTAMPTZ | NO | — | Client-reported event time | 2026-04-18T08:10:00.110Z |
| 8 | client_server_drift_ms | INTEGER | NO | — | client_ts - server_ts in ms | -13 |
| 9 | video_position_seconds | REAL | NO | — | Video position at event time | 45.2 |
| 10 | previous_position_seconds | REAL | YES | NULL | Previous position (for seek events) | 30.0 |
| 11 | seek_delta_seconds | REAL | YES | NULL | Signed seek distance (positive = forward) | 15.2 |
| 12 | playback_speed | REAL | NO | 1.0 | Speed after event | 1.0 |
| 13 | previous_playback_speed | REAL | YES | NULL | Speed before event (for speed_change) | 1.5 |
| 14 | video_quality | TEXT | YES | NULL | Quality after event (for quality_change) | 1080p |
| 15 | previous_video_quality | TEXT | YES | NULL | Quality before event | 720p |
| 16 | broadcast_latency_ms | INTEGER | YES | NULL | ms from server receive to broadcast to all members | 8 |
| 17 | member_count_at_event | SMALLINT | NO | 0 | Active members when event occurred | 4 |
| 18 | members_received | SMALLINT | YES | NULL | Members who acknowledged receipt | 3 |
| 19 | members_out_of_sync_before | SMALLINT | YES | NULL | Members >1s off before this event | 1 |
| 20 | members_out_of_sync_after | SMALLINT | YES | NULL | Members >1s off after this event | 0 |
| 21 | avg_drift_before_ms | REAL | YES | NULL | Average member drift before event | 1200.0 |
| 22 | avg_drift_after_ms | REAL | YES | NULL | Average member drift after event | 80.0 |
| 23 | is_correction | BOOLEAN | NO | false | Was this auto-generated by sync engine (not user action) | false |
| 24 | ws_event_id | TEXT | YES | NULL | WebSocket message ID for deduplication | ws_evt_abc123 |
| 25 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (ws_event_id) WHERE ws_event_id IS NOT NULL   — dedup WS messages
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: room_video_id → ROOM_VIDEOS.id ON DELETE CASCADE
FK: triggered_by_user_id → USERS.id ON DELETE SET NULL
CHECK (event_type IN ('play','pause','seek','speed_change','video_change','quality_change','correction'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_sev_room_time | room_id, server_timestamp DESC | BTREE | Room event replay |
| idx_sev_room_video | room_video_id, server_timestamp | BTREE | Video-level sync analysis |
| idx_sev_user | triggered_by_user_id, server_timestamp | BTREE | User sync activity |
| idx_sev_event_type | event_type, server_timestamp | BTREE | Event type frequency analysis |

**Partition strategy**: RANGE by `server_timestamp`, monthly. Archive partitions older than 6 months to ClickHouse or BigQuery for long-term analytics. Drop PostgreSQL partition after archival.

**Example row**:
```json
{
  "id": "clxsev001",
  "room_id": "clxroom001",
  "room_video_id": "clxrvid001",
  "triggered_by_user_id": "clx9abc123def",
  "event_type": "seek",
  "server_timestamp": "2026-04-18T08:10:00.123Z",
  "client_timestamp": "2026-04-18T08:10:00.110Z",
  "client_server_drift_ms": -13,
  "video_position_seconds": 45.2,
  "previous_position_seconds": 30.0,
  "seek_delta_seconds": 15.2,
  "member_count_at_event": 4,
  "members_out_of_sync_before": 1,
  "members_out_of_sync_after": 0,
  "avg_drift_before_ms": 1200.0,
  "avg_drift_after_ms": 80.0
}
```

**Developer notes**: This table is the highest-value data in the system. `broadcast_latency_ms` is filled in after the broadcast completes (async update). `members_received` may be < `member_count_at_event` if some clients didn't ack in time — track this for reliability metrics. Write to Redis stream first for real-time processing, async-flush to PostgreSQL.

---

### SYNC_QUALITY_SNAPSHOTS

**Purpose**: Periodic snapshots every 30 seconds of sync quality across all members in a room — who is ahead, behind, and by how much.

**Write frequency**: High — one row per active room every 30 seconds
**Read frequency**: Low — quality dashboards, room health monitoring
**Retention**: 3 months — short retention; high volume table
**PII**: NO (user_ids in JSONB array are internal IDs, not PII)

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxsqs001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | room_video_id | TEXT | YES | NULL | FK → ROOM_VIDEOS | clxrvid001 |
| 4 | snapshot_at | TIMESTAMPTZ | NO | now() | When snapshot was taken | 2026-04-18T08:10:30Z |
| 5 | member_count | SMALLINT | NO | 0 | Members in room at snapshot | 4 |
| 6 | members_in_sync | SMALLINT | NO | 0 | Members within 1s of median position | 3 |
| 7 | members_ahead | SMALLINT | NO | 0 | Members >1s ahead of median | 1 |
| 8 | members_behind | SMALLINT | NO | 0 | Members >1s behind median | 0 |
| 9 | max_drift_ahead_ms | INTEGER | YES | NULL | Worst ahead drift | 1200 |
| 10 | max_drift_behind_ms | INTEGER | YES | NULL | Worst behind drift | NULL |
| 11 | average_drift_ms | REAL | YES | NULL | Mean absolute drift across all members | 320.0 |
| 12 | median_drift_ms | REAL | YES | NULL | Median absolute drift | 200.0 |
| 13 | p90_drift_ms | REAL | YES | NULL | 90th percentile drift | 800.0 |
| 14 | video_position_seconds | REAL | YES | NULL | Median video position at snapshot | 120.5 |
| 15 | member_positions | JSONB | NO | '[]' | Array of {user_id, position_s, drift_ms, network_quality} | [...] |
| 16 | average_network_quality | REAL | YES | NULL | Mean network quality score (0–1) | 0.87 |
| 17 | min_network_quality | REAL | YES | NULL | Worst network quality in room | 0.42 |
| 18 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: room_video_id → ROOM_VIDEOS.id ON DELETE SET NULL
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_sqs_room_time | room_id, snapshot_at DESC | BTREE | Room quality time series |
| idx_sqs_snapshot_at | snapshot_at DESC | BTREE | Global quality monitoring |

**Partition strategy**: RANGE by `snapshot_at`, monthly. Drop partitions older than 3 months.

**Example row**:
```json
{
  "id": "clxsqs001",
  "room_id": "clxroom001",
  "snapshot_at": "2026-04-18T08:10:30Z",
  "member_count": 4,
  "members_in_sync": 3,
  "members_ahead": 1,
  "average_drift_ms": 320.0,
  "median_drift_ms": 200.0,
  "p90_drift_ms": 800.0,
  "member_positions": [
    {"user_id": "clxuser1", "position_s": 121.2, "drift_ms": -700, "network_quality": 0.9},
    {"user_id": "clxuser2", "position_s": 120.5, "drift_ms": 0, "network_quality": 0.87}
  ]
}
```

**Developer notes**: Written by a server-side heartbeat job that runs every 30 seconds per active room. Derive from the in-memory room state in Redis rather than querying SYNC_EVENTS. The `member_positions` JSONB array is the key payload — used to render real-time sync health bars in the host dashboard.

---

### BUFFER_EVENTS

**Purpose**: Every buffering event experienced by every user — high volume, separate retention, network context captured.

**Write frequency**: Very high — every buffer start/end for every user watching video
**Read frequency**: Low — quality analysis, ISP/network debugging
**Retention**: 60 days — very high volume; buffer patterns older than 60 days have diminishing analytical value
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxbuf001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | room_video_id | TEXT | YES | NULL | FK → ROOM_VIDEOS | clxrvid001 |
| 4 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 5 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 6 | started_at | TIMESTAMPTZ | NO | now() | Buffer start time | 2026-04-18T08:11:00Z |
| 7 | ended_at | TIMESTAMPTZ | YES | NULL | Buffer end time (NULL if still buffering) | 2026-04-18T08:11:03Z |
| 8 | duration_ms | INTEGER | YES | NULL | Buffer duration in ms; set on end | 3100 |
| 9 | video_position_seconds | REAL | YES | NULL | Video position when buffer started | 124.3 |
| 10 | video_quality | TEXT | YES | NULL | Quality level at time of buffer | 1080p |
| 11 | connection_type | TEXT | YES | NULL | wifi / ethernet / 4g / 3g / 2g / unknown | wifi |
| 12 | effective_type | TEXT | YES | NULL | Effective connection: 4g / 3g / 2g / slow-2g | 4g |
| 13 | effective_bandwidth_mbps | REAL | YES | NULL | Estimated bandwidth at buffer time | 12.4 |
| 14 | rtt_ms | INTEGER | YES | NULL | Round-trip time estimate | 45 |
| 15 | downlink_mbps | REAL | YES | NULL | Downlink speed estimate | 11.8 |
| 16 | buffer_cause | TEXT | YES | NULL | network / seeking / quality_change / startup / unknown | network |
| 17 | was_recovered | BOOLEAN | YES | NULL | Did playback resume? NULL if ongoing | true |
| 18 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: room_video_id → ROOM_VIDEOS.id ON DELETE SET NULL
FK: user_id → USERS.id ON DELETE CASCADE
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (buffer_cause IN ('network','seeking','quality_change','startup','unknown') OR buffer_cause IS NULL)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_buf_user_time | user_id, started_at DESC | BTREE | Per-user buffer history |
| idx_buf_room_time | room_id, started_at DESC | BTREE | Room quality during session |
| idx_buf_started_at | started_at DESC | BTREE | Global buffer rate monitoring |
| idx_buf_connection | connection_type, effective_type | BTREE | Network condition analysis |

**Partition strategy**: RANGE by `started_at`, weekly. Drop partitions older than 60 days.

**Example row**:
```json
{
  "id": "clxbuf001",
  "room_id": "clxroom001",
  "user_id": "clx9abc123def",
  "started_at": "2026-04-18T08:11:00Z",
  "ended_at": "2026-04-18T08:11:03Z",
  "duration_ms": 3100,
  "video_position_seconds": 124.3,
  "video_quality": "1080p",
  "connection_type": "wifi",
  "effective_bandwidth_mbps": 12.4,
  "buffer_cause": "network",
  "was_recovered": true
}
```

**Developer notes**: Extension reports buffer start immediately; sends buffer end (with duration) when playback resumes. If playback never resumes (user leaves room), `ended_at` stays NULL and `was_recovered` stays NULL — handle in analytics queries. Weekly partitions (not monthly) because this is 10–50× higher volume than other event tables.

---

## Group 4 — Complete User Behavior

---

### USER_VIDEO_INTERACTIONS

**Purpose**: Every interaction a user has with the video player — all 30+ YouTube player events with full before/after state capture.

**Write frequency**: Very high — every player action by every user in every session
**Read frequency**: Low — product analytics, feature usage, A/B test evaluation
**Retention**: 1 year active in PostgreSQL; archive to columnar store after 1 year
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxuvi001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 4 | room_video_id | TEXT | YES | NULL | FK → ROOM_VIDEOS | clxrvid001 |
| 5 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 6 | occurred_at | TIMESTAMPTZ | NO | now() | When interaction occurred | 2026-04-18T08:10:05Z |
| 7 | event_type | TEXT | NO | — | play / pause / seek / volume_change / mute / unmute / quality_change / speed_change / fullscreen_enter / fullscreen_exit / theater_enter / theater_exit / miniplayer_enter / miniplayer_exit / chapter_click / subtitle_on / subtitle_off / subtitle_language_change / like / dislike / share_click / add_to_playlist_click / description_expand / description_collapse / card_click / end_screen_click / annotation_click / loop_toggle / autoplay_toggle | pause |
| 8 | video_position_seconds | REAL | YES | NULL | Video position at time of interaction | 120.5 |
| 9 | previous_state | JSONB | YES | NULL | Full player state before interaction | {"playing":true,"position":120.0} |
| 10 | new_state | JSONB | YES | NULL | Full player state after interaction | {"playing":false,"position":120.5} |
| 11 | seek_from_seconds | REAL | YES | NULL | Seek source position | NULL |
| 12 | seek_to_seconds | REAL | YES | NULL | Seek destination position | NULL |
| 13 | seek_method | TEXT | YES | NULL | progress_bar / keyboard / chapter / timestamp | NULL |
| 14 | volume_level | REAL | YES | NULL | Volume level 0.0–1.0 after change | NULL |
| 15 | previous_volume | REAL | YES | NULL | Volume before change | NULL |
| 16 | playback_speed | REAL | YES | NULL | Speed after change | NULL |
| 17 | previous_speed | REAL | YES | NULL | Speed before change | NULL |
| 18 | quality_level | TEXT | YES | NULL | Quality after change | NULL |
| 19 | previous_quality | TEXT | YES | NULL | Quality before change | NULL |
| 20 | subtitle_language | TEXT | YES | NULL | Subtitle language code after change | en |
| 21 | previous_subtitle_language | TEXT | YES | NULL | Previous subtitle language | NULL |
| 22 | is_fullscreen | BOOLEAN | YES | NULL | Fullscreen state after interaction | NULL |
| 23 | is_muted | BOOLEAN | YES | NULL | Mute state after interaction | false |
| 24 | is_theater_mode | BOOLEAN | YES | NULL | Theater mode state after | NULL |
| 25 | is_loop_on | BOOLEAN | YES | NULL | Loop state after toggle | NULL |
| 26 | is_autoplay_on | BOOLEAN | YES | NULL | Autoplay state after toggle | NULL |
| 27 | chapter_index | SMALLINT | YES | NULL | Chapter index for chapter_click events | NULL |
| 28 | trigger_method | TEXT | YES | NULL | click / keyboard / api / system | click |
| 29 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE SET NULL
FK: room_video_id → ROOM_VIDEOS.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (volume_level IS NULL OR volume_level BETWEEN 0 AND 1)
CHECK (previous_volume IS NULL OR previous_volume BETWEEN 0 AND 1)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_uvi_user_time | user_id, occurred_at DESC | BTREE | User interaction history |
| idx_uvi_room_time | room_id, occurred_at DESC | BTREE | Room interaction timeline |
| idx_uvi_event_type | event_type, occurred_at | BTREE | Event frequency analytics |
| idx_uvi_video_pos | room_video_id, video_position_seconds | BTREE | "What % pause at 30s?" |
| idx_uvi_occurred_at | occurred_at DESC | BTREE | Global analytics |

**Partition strategy**: RANGE by `occurred_at`, monthly. Archive to ClickHouse after 1 year.

**Example row**:
```json
{
  "id": "clxuvi001",
  "user_id": "clx9abc123def",
  "room_id": "clxroom001",
  "event_type": "pause",
  "occurred_at": "2026-04-18T08:10:05Z",
  "video_position_seconds": 120.5,
  "previous_state": {"playing": true, "position": 120.0},
  "new_state": {"playing": false, "position": 120.5},
  "is_muted": false,
  "trigger_method": "click"
}
```

**Developer notes**: `previous_state` and `new_state` JSONB capture the full player snapshot — useful for replaying exact playback states in debugging. Null out fields that don't apply to the event type (e.g., `seek_from_seconds` is NULL for a pause event) — don't set them to 0. The extension sends these events via a debounced queue to avoid flooding the server on rapid interactions.

---

### USER_PAGE_INTERACTIONS

**Purpose**: Everything a user does on the YouTube page outside the video player — scroll, comments, related videos, header nav, monetization actions.

**Write frequency**: High — page interactions are frequent and varied
**Read frequency**: Low — product analytics, page engagement research
**Retention**: 6 months
**PII**: NO — all identifiers are hashed or sanitized element types

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxupi001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | YES | NULL | FK → ROOMS; NULL if not in a room | clxroom001 |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | occurred_at | TIMESTAMPTZ | NO | now() | Interaction timestamp | 2026-04-18T08:15:00Z |
| 6 | event_type | TEXT | NO | — | scroll / comment_section_open / comment_section_close / comment_expand / related_video_hover / related_video_click / search_bar_focus / search_bar_submit / notification_click / header_nav_click / channel_subscribe / member_join_click / super_chat / merchandise_click / playlist_add / share_click / like / dislike | related_video_hover |
| 7 | element_type | TEXT | YES | NULL | Sanitized element descriptor — no content | related_video_thumbnail |
| 8 | page_url_hash | TEXT | YES | NULL | SHA-256 of current page URL — no PII | 3d9a1b... |
| 9 | scroll_position_px | INTEGER | YES | NULL | Absolute scroll position in px | 800 |
| 10 | scroll_position_pct | REAL | YES | NULL | Scroll position as % of page height | 0.35 |
| 11 | scroll_direction | TEXT | YES | NULL | up / down | NULL |
| 12 | scroll_speed_px_per_sec | REAL | YES | NULL | Scroll velocity | NULL |
| 13 | viewport_width | SMALLINT | YES | NULL | Browser viewport width in px | 1440 |
| 14 | viewport_height | SMALLINT | YES | NULL | Browser viewport height in px | 900 |
| 15 | video_visible_in_viewport | BOOLEAN | YES | NULL | Was the video element visible when event fired | true |
| 16 | related_video_index | SMALLINT | YES | NULL | Position of hovered/clicked related video (0-indexed) | NULL |
| 17 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_upi_user_time | user_id, occurred_at DESC | BTREE | User page behavior |
| idx_upi_event_type | event_type, occurred_at | BTREE | Frequency analytics |
| idx_upi_room_time | room_id, occurred_at | BTREE | Room context page behavior |

**Partition strategy**: RANGE by `occurred_at`, monthly. Drop after 6 months.

**Example row**:
```json
{
  "id": "clxupi001",
  "user_id": "clx9abc123def",
  "room_id": "clxroom001",
  "event_type": "related_video_hover",
  "occurred_at": "2026-04-18T08:15:00Z",
  "element_type": "related_video_thumbnail",
  "scroll_position_pct": 0.35,
  "viewport_width": 1440,
  "viewport_height": 900,
  "video_visible_in_viewport": true
}
```

**Developer notes**: Never capture any text content of elements — only sanitized element type descriptors. Search bar events capture that the search bar was focused/submitted, never the query text. This is intentional for privacy compliance.

---

### USER_OVERLAY_INTERACTIONS

**Purpose**: Every interaction inside the BingeRoom overlay — chat, reactions, call controls, invite flow, settings, and overlay positioning.

**Write frequency**: High — every overlay action in every session
**Read frequency**: Low — feature adoption analytics, UX research
**Retention**: 1 year
**PII**: NO — message content not captured here (only lengths and timing)

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxuoi001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | occurred_at | TIMESTAMPTZ | NO | now() | Event timestamp | 2026-04-18T08:12:00Z |
| 6 | event_type | TEXT | NO | — | chat_open / chat_close / chat_focus / chat_blur / message_compose_start / message_compose_abandon / message_send / reaction_click / call_join / call_leave / mic_toggle / camera_toggle / speaker_volume_change / overlay_expand / overlay_collapse / overlay_resize / overlay_drag / invite_link_copy / room_code_copy / member_list_open / member_list_close / member_click / host_control_use / settings_open / settings_close / tab_switch_chat / tab_switch_members / tab_switch_settings / invite_click | message_send |
| 7 | overlay_tab | TEXT | YES | NULL | Active tab: chat / members / settings / reactions | chat |
| 8 | is_overlay_expanded | BOOLEAN | YES | NULL | Whether overlay was expanded at event time | true |
| 9 | overlay_position_x | SMALLINT | YES | NULL | Overlay X position in viewport | 1200 |
| 10 | overlay_position_y | SMALLINT | YES | NULL | Overlay Y position in viewport | 100 |
| 11 | overlay_width | SMALLINT | YES | NULL | Overlay width in px | 320 |
| 12 | overlay_height | SMALLINT | YES | NULL | Overlay height in px | 600 |
| 13 | message_length_chars | SMALLINT | YES | NULL | Message length at send/abandon (no content) | 42 |
| 14 | compose_duration_ms | INTEGER | YES | NULL | Time from compose_start to send/abandon | 8500 |
| 15 | compose_clear_count | SMALLINT | YES | NULL | Times user cleared without sending | 1 |
| 16 | reaction_emoji | TEXT | YES | NULL | Emoji identifier for reaction events | 😂 |
| 17 | reaction_video_position | REAL | YES | NULL | Video position when reaction was sent | 45.2 |
| 18 | reaction_delay_ms | INTEGER | YES | NULL | Time from last sync event to reaction (responsiveness) | 1200 |
| 19 | mic_is_on | BOOLEAN | YES | NULL | Mic state after toggle | true |
| 20 | camera_is_on | BOOLEAN | YES | NULL | Camera state after toggle | false |
| 21 | speaker_volume_level | REAL | YES | NULL | Speaker volume 0.0–1.0 after change | NULL |
| 22 | host_control_action | TEXT | YES | NULL | Which host control was used | kick_member |
| 23 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (speaker_volume_level IS NULL OR speaker_volume_level BETWEEN 0 AND 1)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_uoi_user_time | user_id, occurred_at DESC | BTREE | User overlay behavior |
| idx_uoi_room_time | room_id, occurred_at | BTREE | Room interaction timeline |
| idx_uoi_event_type | event_type, occurred_at | BTREE | Feature usage funnels |

**Partition strategy**: RANGE by `occurred_at`, monthly. Archive after 1 year.

**Example row**:
```json
{
  "id": "clxuoi001",
  "user_id": "clx9abc123def",
  "room_id": "clxroom001",
  "event_type": "message_send",
  "occurred_at": "2026-04-18T08:12:00Z",
  "overlay_tab": "chat",
  "is_overlay_expanded": true,
  "message_length_chars": 42,
  "compose_duration_ms": 8500,
  "compose_clear_count": 0
}
```

**Developer notes**: `reaction_emoji` stores the Unicode emoji character, not a description — keep it consistent with what's sent over the WebSocket. `message_length_chars` is captured client-side at the moment of send from the DOM input length — this captures the final message length without capturing content.

---

### USER_TAB_EVENTS

**Purpose**: Browser tab and window focus/blur events — critical for understanding engagement depth and background-tab behavior.

**Write frequency**: High — fires on every tab switch and visibility change
**Read frequency**: Low — engagement analysis, DAU calculation, notification effectiveness
**Retention**: 6 months
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxute001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | occurred_at | TIMESTAMPTZ | NO | now() | Event timestamp | 2026-04-18T08:20:00Z |
| 6 | event_type | TEXT | NO | — | tab_focus / tab_blur / visibility_change / window_focus / window_blur / beforeunload / unload | tab_blur |
| 7 | visibility_state | TEXT | YES | NULL | visible / hidden / prerender | hidden |
| 8 | document_hidden | BOOLEAN | YES | NULL | document.hidden value | true |
| 9 | time_in_background_ms | INTEGER | YES | NULL | For tab_focus: how long tab was hidden | NULL |
| 10 | return_trigger | TEXT | YES | NULL | What triggered return: manual / notification / os_notification / unknown | NULL |
| 11 | video_was_playing | BOOLEAN | YES | NULL | Was video playing when tab event fired | true |
| 12 | video_position_seconds | REAL | YES | NULL | Video position at event time | 120.5 |
| 13 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (event_type IN ('tab_focus','tab_blur','visibility_change','window_focus','window_blur','beforeunload','unload'))
CHECK (visibility_state IN ('visible','hidden','prerender') OR visibility_state IS NULL)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_ute_user_time | user_id, occurred_at DESC | BTREE | User tab behavior |
| idx_ute_session | session_id, occurred_at | BTREE | Session-level tab analysis |

**Partition strategy**: RANGE by `occurred_at`, monthly. Drop after 6 months.

**Example row**:
```json
{
  "id": "clxute001",
  "user_id": "clx9abc123def",
  "session_id": "clxses001",
  "event_type": "tab_blur",
  "occurred_at": "2026-04-18T08:20:00Z",
  "visibility_state": "hidden",
  "document_hidden": true,
  "video_was_playing": true,
  "video_position_seconds": 120.5
}
```

**Developer notes**: Listen to `visibilitychange`, `focus`, `blur`, and `beforeunload` DOM events. Pair `tab_blur` and `tab_focus` events to compute `time_in_background_ms` — set it on the focus event by diffing timestamps. `return_trigger` is inferred: if a web push notification was recently delivered to this session, mark `notification`.

---

### USER_SCROLL_EVENTS

**Purpose**: Granular scroll capture (max 1 per 500ms debounce) — scroll direction, velocity, and viewport context.

**Write frequency**: Very high — debounced but still extremely frequent
**Read frequency**: Low — UX analytics, page layout optimization
**Retention**: 30 days — very high volume, low long-term value
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxuse001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | occurred_at | TIMESTAMPTZ | NO | now() | Event timestamp | 2026-04-18T08:15:00Z |
| 6 | direction | TEXT | NO | — | up / down | down |
| 7 | delta_px | INTEGER | NO | — | Scroll delta in px (signed: + = down) | 240 |
| 8 | absolute_position_px | INTEGER | NO | — | Absolute scroll position from top | 800 |
| 9 | page_position_pct | REAL | NO | — | Scroll position as fraction of total page height | 0.35 |
| 10 | scroll_velocity_px_per_sec | REAL | YES | NULL | Px per second at time of debounce | 480.0 |
| 11 | video_in_viewport | BOOLEAN | NO | false | Video element visible at scroll position | true |
| 12 | overlay_in_viewport | BOOLEAN | NO | false | BingeRoom overlay visible | true |
| 13 | scrolled_past_video | BOOLEAN | NO | false | Has user scrolled video fully out of viewport | false |
| 14 | viewport_width | SMALLINT | YES | NULL | Viewport width px | 1440 |
| 15 | viewport_height | SMALLINT | YES | NULL | Viewport height px | 900 |
| 16 | page_height_px | INTEGER | YES | NULL | Total document scroll height | 2300 |
| 17 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (direction IN ('up','down'))
CHECK (page_position_pct BETWEEN 0 AND 1)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_use_user_time | user_id, occurred_at DESC | BTREE | User scroll behavior |
| idx_use_occurred | occurred_at DESC | BTREE | Global scroll analytics |

**Partition strategy**: RANGE by `occurred_at`, weekly. Drop after 30 days.

**Example row**:
```json
{
  "id": "clxuse001",
  "user_id": "clx9abc123def",
  "event_type": "scroll",
  "occurred_at": "2026-04-18T08:15:00Z",
  "direction": "down",
  "delta_px": 240,
  "absolute_position_px": 800,
  "page_position_pct": 0.35,
  "scroll_velocity_px_per_sec": 480.0,
  "video_in_viewport": true
}
```

**Developer notes**: Debounce at 500ms client-side before sending. Batch sends in groups of 10 to reduce WebSocket message frequency. Given 30-day retention, do not run analytics queries against this table in production — instead, materialize scroll depth aggregates nightly into USER_ENGAGEMENT_SCORES.

---

### USER_CURSOR_EVENTS

**Purpose**: Cursor position and hover tracking at max 1 per 250ms — element-type-level only, no content capture, no keystroke logging.

**Write frequency**: Very high — most frequent of all behavior tables
**Read frequency**: Very low — UX heatmap generation only
**Retention**: 14 days — extreme volume; data has value only for recent UX analysis
**PII**: NO — positions are viewport coordinates only, no content captured

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxuce001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | occurred_at | TIMESTAMPTZ | NO | now() | Event timestamp | 2026-04-18T08:12:00Z |
| 6 | event_type | TEXT | NO | — | move / hover_enter / hover_exit / click / drag_start / drag_end | click |
| 7 | viewport_x | SMALLINT | NO | — | Cursor X position in viewport px | 720 |
| 8 | viewport_y | SMALLINT | NO | — | Cursor Y position in viewport px | 450 |
| 9 | target_element_type | TEXT | YES | NULL | Sanitized element category: video / overlay / controls / chat / button / link / page / unknown | controls |
| 10 | hover_duration_ms | INTEGER | YES | NULL | For hover_exit: how long hovered | NULL |
| 11 | is_over_video | BOOLEAN | NO | false | Cursor is over video element | false |
| 12 | is_over_overlay | BOOLEAN | NO | false | Cursor is over BingeRoom overlay | false |
| 13 | is_over_controls | BOOLEAN | NO | false | Cursor is over video controls bar | true |
| 14 | drag_delta_x | SMALLINT | YES | NULL | X drag distance for drag events | NULL |
| 15 | drag_delta_y | SMALLINT | YES | NULL | Y drag distance for drag events | NULL |
| 16 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (event_type IN ('move','hover_enter','hover_exit','click','drag_start','drag_end'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_uce_user_time | user_id, occurred_at DESC | BTREE | Per-user cursor analysis |
| idx_uce_session | session_id, occurred_at | BTREE | Session heatmap generation |

**Partition strategy**: RANGE by `occurred_at`, weekly. Drop after 14 days. Consider not writing to PostgreSQL at all — stream to a dedicated time-series store (e.g., InfluxDB) for heatmaps.

**Example row**:
```json
{
  "id": "clxuce001",
  "user_id": "clx9abc123def",
  "event_type": "click",
  "occurred_at": "2026-04-18T08:12:00Z",
  "viewport_x": 720,
  "viewport_y": 450,
  "target_element_type": "controls",
  "is_over_controls": true
}
```

**Developer notes**: Never capture the text content of clicked elements. `target_element_type` is a coarse category derived from `element.closest('[data-br-type]')` — elements in BingeRoom are tagged at build time with sanitized type identifiers. `is_over_video` etc. are derived from viewport position vs known element bounding rects.

---

### USER_KEYBOARD_EVENTS

**Purpose**: YouTube keyboard shortcut usage — shortcut key only, never text content, never passwords.

**Write frequency**: Medium — on YouTube keyboard shortcuts only, not every keypress
**Read frequency**: Low — keyboard shortcut adoption analytics
**Retention**: 1 year
**PII**: NO — only shortcut keys captured, never free-text input

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxuke001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | occurred_at | TIMESTAMPTZ | NO | now() | Event timestamp | 2026-04-18T08:10:00Z |
| 6 | shortcut_key | TEXT | NO | — | space / f / m / k / j / l / c / i / t / left_arrow / right_arrow / up_arrow / down_arrow / shift_period / shift_comma / digit_0-9 | space |
| 7 | was_effective | BOOLEAN | NO | false | Did the player respond to this shortcut | true |
| 8 | video_position_seconds | REAL | YES | NULL | Video position when shortcut fired | 120.5 |
| 9 | modifier_keys | TEXT[] | NO | '{}' | Active modifier keys: ctrl / shift / alt / meta | {} |
| 10 | target_element_type | TEXT | YES | NULL | Where keyboard focus was: player / page / chat / other | player |
| 11 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_uke_user_time | user_id, occurred_at DESC | BTREE | User keyboard behavior |
| idx_uke_shortcut | shortcut_key, occurred_at | BTREE | Shortcut popularity rankings |

**Partition strategy**: RANGE by `occurred_at`, monthly.

**Example row**:
```json
{
  "id": "clxuke001",
  "user_id": "clx9abc123def",
  "event_type": "space",
  "occurred_at": "2026-04-18T08:10:00Z",
  "shortcut_key": "space",
  "was_effective": true,
  "video_position_seconds": 120.5,
  "target_element_type": "player"
}
```

**Developer notes**: Only capture the defined shortcut keys — use an allowlist in the extension's keydown handler. If a key is not in the allowlist, do not capture it. This ensures we never accidentally log a password or message a user types.

---

### USER_NETWORK_EVENTS

**Purpose**: Network quality changes detected by the extension — connection type, bandwidth estimates, online/offline transitions.

**Write frequency**: Medium — on network state changes (not a constant stream)
**Read frequency**: Low — network quality correlation with buffer/sync events
**Retention**: 6 months
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxune001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | occurred_at | TIMESTAMPTZ | NO | now() | Event timestamp | 2026-04-18T08:10:00Z |
| 6 | event_type | TEXT | NO | — | connection_change / online / offline / quality_update | connection_change |
| 7 | connection_type | TEXT | YES | NULL | wifi / ethernet / 4g / 3g / 2g / slow-2g / bluetooth / cellular / unknown | wifi |
| 8 | effective_type | TEXT | YES | NULL | Navigator effective type: 4g / 3g / 2g / slow-2g | 4g |
| 9 | effective_bandwidth_mbps | REAL | YES | NULL | Estimated bandwidth | 45.2 |
| 10 | rtt_ms | INTEGER | YES | NULL | Navigator RTT estimate | 50 |
| 11 | downlink_mbps | REAL | YES | NULL | Navigator downlink estimate | 42.0 |
| 12 | save_data | BOOLEAN | YES | NULL | Browser data-saver mode enabled | false |
| 13 | previous_connection_type | TEXT | YES | NULL | Prior connection type | cellular |
| 14 | previous_effective_type | TEXT | YES | NULL | Prior effective type | 3g |
| 15 | online | BOOLEAN | NO | true | navigator.onLine at event time | true |
| 16 | offline_duration_ms | INTEGER | YES | NULL | For online events: how long was offline | NULL |
| 17 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (event_type IN ('connection_change','online','offline','quality_update'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_une_user_time | user_id, occurred_at DESC | BTREE | User network history |
| idx_une_session | session_id, occurred_at | BTREE | Session network quality |

**Partition strategy**: RANGE by `occurred_at`, monthly. Drop after 6 months.

**Example row**:
```json
{
  "id": "clxune001",
  "user_id": "clx9abc123def",
  "event_type": "connection_change",
  "occurred_at": "2026-04-18T08:10:00Z",
  "connection_type": "wifi",
  "effective_type": "4g",
  "effective_bandwidth_mbps": 45.2,
  "rtt_ms": 50,
  "previous_connection_type": "cellular",
  "online": true
}
```

**Developer notes**: Uses the Network Information API (`navigator.connection`). Available in Chrome/Edge. Not available in Firefox or Safari — set fields to NULL and log `connection_type = 'unknown'` for unsupported browsers. `quality_update` events fire every 60 seconds if the user is in a room, regardless of whether values changed — useful for building a continuous network quality timeline.

---

### USER_EXTENSION_EVENTS

**Purpose**: Extension lifecycle and connectivity events — install, update, enable/disable, popup interactions, content script injection, and WebSocket connection health.

**Write frequency**: Medium — install/update infrequent; WS events medium; popup events frequent
**Read frequency**: Low — extension health monitoring, onboarding funnel
**Retention**: 1 year
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxuee001 |
| 2 | user_id | TEXT | YES | NULL | FK → USERS; NULL before login | clx9abc123def |
| 3 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 4 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 5 | occurred_at | TIMESTAMPTZ | NO | now() | Event timestamp | 2026-04-18T08:00:00Z |
| 6 | event_type | TEXT | NO | — | installed / updated / enabled / disabled / uninstalled / popup_opened / popup_closed / content_script_injected / content_script_injection_failed / overlay_mounted / overlay_mount_failed / overlay_unmounted / ws_connected / ws_disconnected / ws_reconnect_attempt / ws_reconnect_success / ws_reconnect_failed / ws_error | ws_connected |
| 7 | extension_version | TEXT | YES | NULL | Extension version at event time | 1.4.2 |
| 8 | previous_extension_version | TEXT | YES | NULL | Previous version (for updated events) | 1.4.1 |
| 9 | popup_state | TEXT | YES | NULL | Which popup view was shown: login / main / room / settings | NULL |
| 10 | popup_duration_ms | INTEGER | YES | NULL | How long popup was open | NULL |
| 11 | injection_url_hash | TEXT | YES | NULL | SHA-256 of page URL where injection was attempted | NULL |
| 12 | injection_failure_reason | TEXT | YES | NULL | CSP violation / permission denied / timeout | NULL |
| 13 | overlay_mount_duration_ms | INTEGER | YES | NULL | Time to mount overlay DOM | 42 |
| 14 | overlay_failure_reason | TEXT | YES | NULL | Reason overlay failed to mount | NULL |
| 15 | ws_close_code | SMALLINT | YES | NULL | WebSocket close code | NULL |
| 16 | ws_close_reason | TEXT | YES | NULL | WebSocket close reason string | NULL |
| 17 | ws_reconnect_attempt_number | SMALLINT | YES | NULL | Which reconnect attempt (1, 2, 3…) | NULL |
| 18 | ws_reconnect_delay_ms | INTEGER | YES | NULL | Backoff delay before this attempt | NULL |
| 19 | ws_total_disconnected_ms | INTEGER | YES | NULL | Cumulative WS downtime this session | NULL |
| 20 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE SET NULL   — keep logs even if user deleted
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
FK: room_id → ROOMS.id ON DELETE SET NULL
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_uee_user_time | user_id, occurred_at DESC | BTREE | User extension history |
| idx_uee_event_type | event_type, occurred_at | BTREE | Extension health monitoring |
| idx_uee_ws_events | event_type, extension_version | BTREE | WS stability by version |

**Partition strategy**: RANGE by `occurred_at`, monthly.

**Example row**:
```json
{
  "id": "clxuee001",
  "user_id": "clx9abc123def",
  "event_type": "ws_connected",
  "occurred_at": "2026-04-18T08:00:00Z",
  "extension_version": "1.4.2",
  "ws_total_disconnected_ms": 0
}
```

**Developer notes**: `user_id` is NULL for events that fire before the user authenticates (e.g., `installed`, `popup_opened`). Match these to users retroactively via device fingerprint after login. `injection_url_hash` enables analysis of which pages block extension injection due to strict CSPs — important for Netflix/Prime support planning.


---

## Group 5 — Chat and Reactions

---

### MESSAGES

**Purpose**: Full message lifecycle in every room — content, timing, edits, deletes, video context, reply chains, and moderation state.

**Write frequency**: High — every message sent, edited, or deleted
**Read frequency**: High — chat panel loads recent messages on join
**Retention**: 2 years active; archive chat history after 2 years
**PII**: YES — `content` (user-generated text)

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxmsg001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 4 | content | TEXT | NO | — | Message text **(PII — user content)** | This part is so good!! |
| 5 | content_hash | TEXT | NO | — | SHA-256 of content for dedup and moderation | 9f86d0... |
| 6 | type | TEXT | NO | 'text' | text / system / reaction_notification | text |
| 7 | status | TEXT | NO | 'sent' | sent / edited / deleted / moderated | sent |
| 8 | created_at | TIMESTAMPTZ | NO | now() | When message was sent | 2026-04-18T08:12:00Z |
| 9 | updated_at | TIMESTAMPTZ | NO | now() | Last update to this row | 2026-04-18T08:12:00Z |
| 10 | edited_at | TIMESTAMPTZ | YES | NULL | When message was edited | NULL |
| 11 | deleted_at | TIMESTAMPTZ | YES | NULL | When message was deleted (soft delete) | NULL |
| 12 | deleted_by_user_id | TEXT | YES | NULL | FK → USERS; self, host, or moderator | NULL |
| 13 | deletion_reason | TEXT | YES | NULL | self / host_removed / moderation / spam | NULL |
| 14 | parent_message_id | TEXT | YES | NULL | FK → MESSAGES; for reply threads | NULL |
| 15 | reply_count | SMALLINT | NO | 0 | Count of direct replies | 0 |
| 16 | reaction_count | SMALLINT | NO | 0 | Count of message reactions (denormalized) | 3 |
| 17 | video_position_seconds | REAL | YES | NULL | Video position when message was sent | 120.5 |
| 18 | room_video_id | TEXT | YES | NULL | FK → ROOM_VIDEOS; which video was playing | clxrvid001 |
| 19 | char_count | SMALLINT | NO | 0 | Character count of content | 22 |
| 20 | word_count | SMALLINT | NO | 0 | Word count of content | 5 |
| 21 | compose_duration_ms | INTEGER | YES | NULL | Time spent composing (from TYPING_INDICATORS) | 8500 |
| 22 | was_edited | BOOLEAN | NO | false | Has this message ever been edited | false |
| 23 | edit_count | SMALLINT | NO | 0 | Number of edits | 0 |
| 24 | is_pinned | BOOLEAN | NO | false | Pinned by host | false |
| 25 | pinned_by_user_id | TEXT | YES | NULL | FK → USERS | NULL |
| 26 | pinned_at | TIMESTAMPTZ | YES | NULL | When pinned | NULL |
| 27 | moderation_flagged | BOOLEAN | NO | false | Flagged by auto-moderation | false |
| 28 | moderation_flagged_at | TIMESTAMPTZ | YES | NULL | When flagged | NULL |
| 29 | moderation_action | TEXT | YES | NULL | none / hidden / deleted / user_warned | NULL |
| 30 | toxicity_score | REAL | YES | NULL | ML toxicity score 0.0–1.0 | NULL |
| 31 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: user_id → USERS.id ON DELETE RESTRICT
FK: parent_message_id → MESSAGES.id ON DELETE SET NULL
FK: deleted_by_user_id → USERS.id ON DELETE SET NULL
FK: pinned_by_user_id → USERS.id ON DELETE SET NULL
FK: room_video_id → ROOM_VIDEOS.id ON DELETE SET NULL
CHECK (type IN ('text','system','reaction_notification'))
CHECK (status IN ('sent','edited','deleted','moderated'))
CHECK (toxicity_score IS NULL OR toxicity_score BETWEEN 0 AND 1)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_msg_room_time | room_id, created_at DESC | BTREE | Chat panel: load recent messages |
| idx_msg_user | user_id, created_at DESC | BTREE | User message history |
| idx_msg_parent | parent_message_id | BTREE | Load replies to a message |
| idx_msg_video_pos | room_video_id, video_position_seconds | BTREE | Messages at specific video moments |
| idx_msg_moderation | moderation_flagged, created_at | BTREE | Moderation queue |

**Partition strategy**: RANGE by `created_at`, monthly. Archive after 2 years.

**Example row**:
```json
{
  "id": "clxmsg001",
  "room_id": "clxroom001",
  "user_id": "clx9abc123def",
  "content": "This part is so good!!",
  "content_hash": "9f86d081...",
  "type": "text",
  "status": "sent",
  "created_at": "2026-04-18T08:12:00Z",
  "video_position_seconds": 120.5,
  "char_count": 22,
  "word_count": 5,
  "toxicity_score": 0.02
}
```

**Developer notes**: Soft-delete only — set `deleted_at` and `status = 'deleted'`, never physically delete rows (needed for moderation audit). When serving to chat clients, filter `WHERE deleted_at IS NULL` or replace content with "[deleted]" based on product decision. `content_hash` is used for exact-duplicate detection (spam) — not for privacy.

---

### MESSAGE_REACTIONS

**Purpose**: Reactions to specific messages — emoji, who sent it, when, and whether it was removed.

**Write frequency**: Medium — on every message reaction add/remove
**Read frequency**: High — loaded with messages in chat panel
**Retention**: 2 years (matches MESSAGES)
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxmrx001 |
| 2 | message_id | TEXT | NO | — | FK → MESSAGES | clxmsg001 |
| 3 | room_id | TEXT | NO | — | FK → ROOMS (denormalized for efficient queries) | clxroom001 |
| 4 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 5 | emoji | TEXT | NO | — | Emoji character | 😂 |
| 6 | emoji_name | TEXT | YES | NULL | Emoji slug name for analytics | joy |
| 7 | created_at | TIMESTAMPTZ | NO | now() | When reaction was added | 2026-04-18T08:12:30Z |
| 8 | removed_at | TIMESTAMPTZ | YES | NULL | When reaction was removed | NULL |
| 9 | is_removed | BOOLEAN | NO | false | Whether reaction is currently active | false |
| 10 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (message_id, user_id, emoji) WHERE is_removed = false   — one active reaction per emoji per user per message
FK: message_id → MESSAGES.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: user_id → USERS.id ON DELETE CASCADE
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_mrx_message | message_id, is_removed | BTREE | Reactions for a message |
| idx_mrx_room_time | room_id, created_at | BTREE | Room reaction analytics |
| idx_mrx_emoji | emoji_name, created_at | BTREE | Most popular emojis |

**Partition strategy**: RANGE by `created_at`, monthly.

**Example row**:
```json
{
  "id": "clxmrx001",
  "message_id": "clxmsg001",
  "room_id": "clxroom001",
  "user_id": "clx9abc123def",
  "emoji": "😂",
  "emoji_name": "joy",
  "created_at": "2026-04-18T08:12:30Z",
  "is_removed": false
}
```

---

### VIDEO_REACTIONS

**Purpose**: Emoji reactions to specific video moments — the float-up animation data. Full context: who sent it, what position, how many people saw it.

**Write frequency**: High — every floating emoji reaction sent
**Read frequency**: Low — analytics only; real-time reactions go through WebSocket/Redis
**Retention**: 1 year
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxvrx001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | room_video_id | TEXT | NO | — | FK → ROOM_VIDEOS | clxrvid001 |
| 4 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 5 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 6 | emoji | TEXT | NO | — | Emoji character | 🔥 |
| 7 | emoji_name | TEXT | YES | NULL | Emoji slug | fire |
| 8 | video_position_seconds | REAL | NO | — | Video position when reaction was sent | 45.2 |
| 9 | created_at | TIMESTAMPTZ | NO | now() | Server receive time | 2026-04-18T08:10:45Z |
| 10 | members_in_room_at_time | SMALLINT | YES | NULL | How many members were present | 4 |
| 11 | was_synced | BOOLEAN | NO | true | Did all members receive it near-simultaneously | true |
| 12 | animation_type | TEXT | NO | 'float_up' | float_up / burst / standard | float_up |
| 13 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: room_video_id → ROOM_VIDEOS.id ON DELETE CASCADE
FK: user_id → USERS.id ON DELETE CASCADE
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (animation_type IN ('float_up','burst','standard'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_vrx_room_pos | room_video_id, video_position_seconds | BTREE | "Most reacted video moments" |
| idx_vrx_room_time | room_id, created_at | BTREE | Room reaction history |
| idx_vrx_emoji | emoji_name, video_position_seconds | BTREE | Emoji-position heatmaps |

**Partition strategy**: RANGE by `created_at`, monthly.

**Example row**:
```json
{
  "id": "clxvrx001",
  "room_id": "clxroom001",
  "room_video_id": "clxrvid001",
  "user_id": "clx9abc123def",
  "emoji": "🔥",
  "emoji_name": "fire",
  "video_position_seconds": 45.2,
  "created_at": "2026-04-18T08:10:45Z",
  "members_in_room_at_time": 4,
  "was_synced": true
}
```

---

### TYPING_INDICATORS

**Purpose**: Typing event analytics — started typing, stopped, sent or abandoned, compose duration, and retyping behavior.

**Write frequency**: High — every typing start/stop in every chat session
**Read frequency**: Very low — product analytics only (real-time indicators use Redis)
**Retention**: 90 days — high volume, low long-term value
**PII**: NO — never captures content

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxtyp001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | started_at | TIMESTAMPTZ | NO | now() | When user started typing | 2026-04-18T08:11:51Z |
| 6 | stopped_at | TIMESTAMPTZ | YES | NULL | When user stopped (sent, abandoned, or idle timeout) | 2026-04-18T08:12:00Z |
| 7 | duration_ms | INTEGER | YES | NULL | stopped_at - started_at | 9000 |
| 8 | outcome | TEXT | YES | NULL | sent / abandoned / timeout | sent |
| 9 | clear_count | SMALLINT | NO | 0 | Times user deleted all text without sending | 0 |
| 10 | retyped_count | SMALLINT | NO | 0 | Times text was fully cleared and restarted | 0 |
| 11 | video_position_at_start | REAL | YES | NULL | Video position when typing began | 119.0 |
| 12 | video_position_at_end | REAL | YES | NULL | Video position when typing ended | 120.5 |
| 13 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: user_id → USERS.id ON DELETE CASCADE
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (outcome IN ('sent','abandoned','timeout') OR outcome IS NULL)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_typ_room_time | room_id, started_at | BTREE | Room typing patterns |
| idx_typ_outcome | outcome, started_at | BTREE | Abandon rate analysis |

**Partition strategy**: RANGE by `started_at`, monthly. Drop after 90 days.

**Example row**:
```json
{
  "id": "clxtyp001",
  "room_id": "clxroom001",
  "user_id": "clx9abc123def",
  "started_at": "2026-04-18T08:11:51Z",
  "stopped_at": "2026-04-18T08:12:00Z",
  "duration_ms": 9000,
  "outcome": "sent",
  "clear_count": 0,
  "video_position_at_start": 119.0,
  "video_position_at_end": 120.5
}
```

**Developer notes**: Real-time typing indicators ("Alex is typing…") are handled entirely in Redis (`room:{id}:typing` set with per-user TTL). This table is for analytics only — flush asynchronously after outcome is determined, not in real time.

---

## Group 6 — Call (Daily.co)

---

### CALL_SESSIONS

**Purpose**: Every Daily.co call session ever started in a room — duration, quality summary, and outcome.

**Write frequency**: Low — one row per call session
**Read frequency**: Low — call analytics, room history
**Retention**: 2 years
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxcall001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 3 | daily_room_id | TEXT | YES | NULL | Daily.co room identifier | abc123_daily |
| 4 | daily_session_id | TEXT | YES | NULL | Daily.co session identifier | sess_xyz789 |
| 5 | status | TEXT | NO | 'active' | active / ended / failed | ended |
| 6 | started_at | TIMESTAMPTZ | NO | now() | When call began | 2026-04-18T08:06:00Z |
| 7 | ended_at | TIMESTAMPTZ | YES | NULL | When call ended | 2026-04-18T09:06:00Z |
| 8 | duration_seconds | INTEGER | YES | NULL | Call duration | 3600 |
| 9 | peak_participant_count | SMALLINT | NO | 0 | Max simultaneous call participants | 4 |
| 10 | total_participants | SMALLINT | NO | 0 | Total unique participants | 5 |
| 11 | ended_reason | TEXT | YES | NULL | all_left / host_ended / room_ended / timeout / error | all_left |
| 12 | average_audio_quality | REAL | YES | NULL | Mean audio quality score 0–1 | 0.92 |
| 13 | average_video_quality | REAL | YES | NULL | Mean video quality score 0–1 | 0.85 |
| 14 | total_audio_dropout_events | SMALLINT | NO | 0 | Total audio dropout events in session | 2 |
| 15 | total_video_freeze_events | SMALLINT | NO | 0 | Total video freeze events | 1 |
| 16 | total_reconnection_events | SMALLINT | NO | 0 | Total participant reconnections | 1 |
| 17 | metadata | JSONB | NO | '{}' | Daily.co webhook payload | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: room_id → ROOMS.id ON DELETE CASCADE
CHECK (status IN ('active','ended','failed'))
CHECK (ended_reason IN ('all_left','host_ended','room_ended','timeout','error') OR ended_reason IS NULL)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_call_room | room_id, started_at | BTREE | Room's call history |
| idx_call_started | started_at DESC | BTREE | Call volume dashboard |
| idx_call_daily_sid | daily_session_id | BTREE | Webhook correlation |

**Partition strategy**: RANGE by `started_at`, monthly.

**Example row**:
```json
{
  "id": "clxcall001",
  "room_id": "clxroom001",
  "daily_session_id": "sess_xyz789",
  "status": "ended",
  "started_at": "2026-04-18T08:06:00Z",
  "ended_at": "2026-04-18T09:06:00Z",
  "duration_seconds": 3600,
  "peak_participant_count": 4,
  "total_participants": 5,
  "average_audio_quality": 0.92
}
```

---

### CALL_PARTICIPANTS

**Purpose**: Every participant in every call — join/leave times, media state history, network quality, speaking time, and camera time.

**Write frequency**: Low — one row per participant per session, updated on leave
**Read frequency**: Low — call analytics
**Retention**: 2 years
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxcpar001 |
| 2 | call_session_id | TEXT | NO | — | FK → CALL_SESSIONS | clxcall001 |
| 3 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 4 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 5 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 6 | daily_participant_id | TEXT | YES | NULL | Daily.co participant identifier | part_abc |
| 7 | joined_at | TIMESTAMPTZ | NO | now() | When participant joined | 2026-04-18T08:06:00Z |
| 8 | left_at | TIMESTAMPTZ | YES | NULL | When participant left | 2026-04-18T09:06:00Z |
| 9 | duration_seconds | INTEGER | YES | NULL | Time in call | 3600 |
| 10 | audio_enabled_on_join | BOOLEAN | NO | false | Mic state at join | true |
| 11 | video_enabled_on_join | BOOLEAN | NO | false | Camera state at join | false |
| 12 | mic_on_time_seconds | INTEGER | NO | 0 | Total seconds mic was unmuted | 2400 |
| 13 | camera_on_time_seconds | INTEGER | NO | 0 | Total seconds camera was on | 0 |
| 14 | mic_toggle_count | SMALLINT | NO | 0 | How many times mic was toggled | 5 |
| 15 | camera_toggle_count | SMALLINT | NO | 0 | How many times camera was toggled | 0 |
| 16 | speaking_events | SMALLINT | NO | 0 | Distinct speaking bursts detected | 32 |
| 17 | speaking_time_seconds | INTEGER | NO | 0 | Total speaking time | 840 |
| 18 | network_quality_avg | REAL | YES | NULL | Average quality score 0–1 | 0.89 |
| 19 | network_quality_min | REAL | YES | NULL | Worst quality score | 0.45 |
| 20 | packet_loss_pct | REAL | YES | NULL | Average packet loss | 0.8 |
| 21 | average_rtt_ms | REAL | YES | NULL | Average RTT to Daily.co | 45.0 |
| 22 | left_reason | TEXT | YES | NULL | self_left / kicked / network_error / room_ended | self_left |
| 23 | metadata | JSONB | NO | '{}' | Daily.co participant data | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: call_session_id → CALL_SESSIONS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: user_id → USERS.id ON DELETE RESTRICT
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
CHECK (left_reason IN ('self_left','kicked','network_error','room_ended') OR left_reason IS NULL)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_cpar_call | call_session_id, joined_at | BTREE | Participants in a call |
| idx_cpar_user | user_id, joined_at | BTREE | User call history |

**Partition strategy**: RANGE by `joined_at`, monthly.

**Example row**:
```json
{
  "id": "clxcpar001",
  "call_session_id": "clxcall001",
  "user_id": "clx9abc123def",
  "joined_at": "2026-04-18T08:06:00Z",
  "duration_seconds": 3600,
  "mic_on_time_seconds": 2400,
  "speaking_time_seconds": 840,
  "network_quality_avg": 0.89,
  "left_reason": "self_left"
}
```

---

### CALL_QUALITY_EVENTS

**Purpose**: Quality degradation events per participant per call — packet loss, jitter, audio dropouts, video freezes, resolution drops.

**Write frequency**: Medium — on quality degradation events
**Read frequency**: Low — quality debugging, ISP analysis
**Retention**: 6 months
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxcqe001 |
| 2 | call_session_id | TEXT | NO | — | FK → CALL_SESSIONS | clxcall001 |
| 3 | call_participant_id | TEXT | NO | — | FK → CALL_PARTICIPANTS | clxcpar001 |
| 4 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 5 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 6 | occurred_at | TIMESTAMPTZ | NO | now() | When event occurred | 2026-04-18T08:30:00Z |
| 7 | event_type | TEXT | NO | — | audio_dropout / video_freeze / packet_loss_spike / jitter_spike / rtt_spike / reconnect / quality_degraded / quality_recovered | audio_dropout |
| 8 | severity | TEXT | NO | 'low' | low / medium / high / critical | medium |
| 9 | duration_ms | INTEGER | YES | NULL | How long the degradation lasted | 800 |
| 10 | packet_loss_pct | REAL | YES | NULL | Packet loss at event time | 12.5 |
| 11 | jitter_ms | REAL | YES | NULL | Jitter in ms | 45.0 |
| 12 | rtt_ms | INTEGER | YES | NULL | RTT in ms | 220 |
| 13 | audio_dropout_ms | INTEGER | YES | NULL | Duration of audio gap | 800 |
| 14 | video_freeze_ms | INTEGER | YES | NULL | Duration of video freeze | NULL |
| 15 | resolution_at_event | TEXT | YES | NULL | Video resolution at event | 360p |
| 16 | bitrate_at_event | INTEGER | YES | NULL | Bitrate in kbps at event | 800 |
| 17 | network_type | TEXT | YES | NULL | Connection type at event | wifi |
| 18 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: call_session_id → CALL_SESSIONS.id ON DELETE CASCADE
FK: call_participant_id → CALL_PARTICIPANTS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: user_id → USERS.id ON DELETE CASCADE
CHECK (event_type IN ('audio_dropout','video_freeze','packet_loss_spike','jitter_spike','rtt_spike','reconnect','quality_degraded','quality_recovered'))
CHECK (severity IN ('low','medium','high','critical'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_cqe_participant | call_participant_id, occurred_at | BTREE | Participant quality timeline |
| idx_cqe_session | call_session_id, occurred_at | BTREE | Call quality overview |
| idx_cqe_severity | severity, occurred_at | BTREE | High-severity monitoring |

**Partition strategy**: RANGE by `occurred_at`, monthly. Drop after 6 months.

**Example row**:
```json
{
  "id": "clxcqe001",
  "call_session_id": "clxcall001",
  "user_id": "clx9abc123def",
  "event_type": "audio_dropout",
  "severity": "medium",
  "occurred_at": "2026-04-18T08:30:00Z",
  "duration_ms": 800,
  "packet_loss_pct": 12.5,
  "network_type": "wifi"
}
```

---

## Group 7 — Analytics and Growth

---

### ROOM_SESSIONS_SUMMARY

**Purpose**: One summary row per room lifecycle — pre-aggregated metrics for fast dashboard queries, avoiding expensive joins on raw event tables.

**Write frequency**: Low — written once when room ends, updated if corrections run
**Read frequency**: High — analytics dashboards, admin panels
**Retention**: Forever
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxrss001 |
| 2 | room_id | TEXT | NO | — | FK → ROOMS (1:1 per room) | clxroom001 |
| 3 | host_user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 4 | platform | TEXT | NO | — | youtube / netflix / prime / disney_plus | youtube |
| 5 | started_at | TIMESTAMPTZ | YES | NULL | Room started_at | 2026-04-18T08:05:00Z |
| 6 | ended_at | TIMESTAMPTZ | YES | NULL | Room ended_at | 2026-04-18T09:30:00Z |
| 7 | duration_seconds | INTEGER | YES | NULL | Total room duration | 5100 |
| 8 | peak_member_count | SMALLINT | NO | 0 | Max simultaneous members | 6 |
| 9 | total_unique_members | SMALLINT | NO | 0 | Total unique members who joined | 8 |
| 10 | total_messages | INTEGER | NO | 0 | Total messages sent | 147 |
| 11 | total_video_reactions | INTEGER | NO | 0 | Total video emoji reactions | 42 |
| 12 | total_message_reactions | INTEGER | NO | 0 | Total message emoji reactions | 15 |
| 13 | total_sync_events | INTEGER | NO | 0 | Total sync events | 23 |
| 14 | total_videos_watched | SMALLINT | NO | 0 | Videos played | 2 |
| 15 | total_watch_time_seconds | INTEGER | NO | 0 | Sum of all member watch times | 43200 |
| 16 | average_sync_drift_ms | REAL | YES | NULL | Average sync drift across all events | 180.5 |
| 17 | max_sync_drift_ms | REAL | YES | NULL | Worst drift | 2400.0 |
| 18 | members_with_buffer_events | SMALLINT | NO | 0 | Members who experienced at least one buffer | 2 |
| 19 | average_member_watch_time_seconds | REAL | YES | NULL | Mean watch time per member | 5400.0 |
| 20 | member_retention_rate | REAL | YES | NULL | Fraction of members who stayed >50% of duration | 0.75 |
| 21 | call_session_count | SMALLINT | NO | 0 | Number of call sessions | 1 |
| 22 | call_peak_participants | SMALLINT | NO | 0 | Peak call participants | 4 |
| 23 | call_total_participation_rate | REAL | YES | NULL | % of members who ever joined call | 0.6 |
| 24 | host_triggered_syncs | SMALLINT | NO | 0 | Syncs triggered by host | 15 |
| 25 | member_triggered_syncs | SMALLINT | NO | 0 | Syncs triggered by members | 8 |
| 26 | new_user_count | SMALLINT | NO | 0 | Members for whom this was their first room | 1 |
| 27 | returning_user_count | SMALLINT | NO | 0 | Members with prior room history | 7 |
| 28 | average_member_engagement_score | REAL | YES | NULL | Mean engagement score across members | 72.5 |
| 29 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (room_id)    — one summary per room
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: host_user_id → USERS.id ON DELETE RESTRICT
CHECK (member_retention_rate IS NULL OR member_retention_rate BETWEEN 0 AND 1)
CHECK (call_total_participation_rate IS NULL OR call_total_participation_rate BETWEEN 0 AND 1)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_rss_host | host_user_id, started_at DESC | BTREE | Host analytics |
| idx_rss_platform | platform, started_at | BTREE | Platform analytics |
| idx_rss_started | started_at DESC | BTREE | Global room volume |

**Partition strategy**: RANGE by `started_at`, yearly (low volume).

**Example row**:
```json
{
  "id": "clxrss001",
  "room_id": "clxroom001",
  "platform": "youtube",
  "duration_seconds": 5100,
  "peak_member_count": 6,
  "total_unique_members": 8,
  "total_messages": 147,
  "average_sync_drift_ms": 180.5,
  "member_retention_rate": 0.75,
  "call_total_participation_rate": 0.6
}
```

---

### USER_WATCH_HISTORY

**Purpose**: Per user per video watched — context, duration, completion, social context, and re-watch tracking.

**Write frequency**: Low — one row per user per video per room session; updated on completion
**Read frequency**: Medium — user profile, watch history UI, recommendations
**Retention**: Forever
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxuwh001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 4 | room_video_id | TEXT | NO | — | FK → ROOM_VIDEOS | clxrvid001 |
| 5 | platform | TEXT | NO | — | Platform watched on | youtube |
| 6 | platform_video_id | TEXT | NO | — | Platform video ID | dQw4w9WgXcQ |
| 7 | video_title | TEXT | YES | NULL | Denormalized title for quick display | Never Gonna Give You Up |
| 8 | started_at | TIMESTAMPTZ | NO | now() | When this watch session began | 2026-04-18T08:05:00Z |
| 9 | ended_at | TIMESTAMPTZ | YES | NULL | When watch session ended | 2026-04-18T08:08:32Z |
| 10 | watch_duration_seconds | INTEGER | NO | 0 | Actual watch time | 212 |
| 11 | completion_rate | REAL | YES | NULL | Fraction of video watched 0–1 | 1.0 |
| 12 | role_in_room | TEXT | NO | 'member' | host / co_host / member | member |
| 13 | average_member_count | REAL | YES | NULL | Average members in room during watch | 4.2 |
| 14 | messages_sent_during | INTEGER | NO | 0 | Messages sent while watching this video | 12 |
| 15 | reactions_sent_during | SMALLINT | NO | 0 | Reactions sent | 5 |
| 16 | call_participation | BOOLEAN | NO | false | Was on a call while watching | true |
| 17 | video_duration_seconds | INTEGER | YES | NULL | Total video length | 212 |
| 18 | resume_position_seconds | REAL | YES | NULL | Where to resume if they return | NULL |
| 19 | rewatch_count | SMALLINT | NO | 0 | Times watched this video in any room | 1 |
| 20 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE CASCADE
FK: room_id → ROOMS.id ON DELETE SET NULL
FK: room_video_id → ROOM_VIDEOS.id ON DELETE CASCADE
CHECK (completion_rate IS NULL OR completion_rate BETWEEN 0 AND 1)
CHECK (role_in_room IN ('host','co_host','member'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_uwh_user | user_id, started_at DESC | BTREE | User watch history page |
| idx_uwh_video | platform, platform_video_id | BTREE | "How many users watched this video?" |
| idx_uwh_user_video | user_id, platform_video_id | BTREE | Rewatch detection |

**Partition strategy**: RANGE by `started_at`, monthly.

**Example row**:
```json
{
  "id": "clxuwh001",
  "user_id": "clx9abc123def",
  "platform_video_id": "dQw4w9WgXcQ",
  "video_title": "Never Gonna Give You Up",
  "watch_duration_seconds": 212,
  "completion_rate": 1.0,
  "role_in_room": "member",
  "messages_sent_during": 12,
  "call_participation": true
}
```

---

### USER_ENGAGEMENT_SCORES

**Purpose**: Daily/weekly/monthly computed engagement scores per user — activity, social engagement, feature adoption, and retention risk.

**Write frequency**: Low — written by nightly/weekly batch compute job
**Read frequency**: Medium — product dashboards, churn prediction, targeted comms
**Retention**: 2 years
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxues001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | period_type | TEXT | NO | — | daily / weekly / monthly | weekly |
| 4 | period_start | DATE | NO | — | Period start date | 2026-04-14 |
| 5 | period_end | DATE | NO | — | Period end date | 2026-04-20 |
| 6 | computed_at | TIMESTAMPTZ | NO | now() | When this row was computed | 2026-04-21T02:00:00Z |
| 7 | activity_score | REAL | NO | 0 | 0–100 raw activity level | 72.5 |
| 8 | social_score | REAL | NO | 0 | 0–100 social engagement (rooms, messages) | 68.0 |
| 9 | feature_adoption_score | REAL | NO | 0 | 0–100 features used vs available | 55.0 |
| 10 | retention_risk_score | REAL | NO | 0 | 0–1; higher = more likely to churn | 0.18 |
| 11 | retention_risk_tier | TEXT | NO | 'low' | low / medium / high / critical | low |
| 12 | rooms_hosted | SMALLINT | NO | 0 | Rooms hosted in period | 2 |
| 13 | rooms_joined | SMALLINT | NO | 0 | Rooms joined in period | 5 |
| 14 | watch_time_seconds | INTEGER | NO | 0 | Watch time in period | 18000 |
| 15 | messages_sent | SMALLINT | NO | 0 | Messages sent in period | 84 |
| 16 | reactions_sent | SMALLINT | NO | 0 | Reactions sent | 28 |
| 17 | calls_joined | SMALLINT | NO | 0 | Calls joined | 3 |
| 18 | features_used_count | SMALLINT | NO | 0 | Distinct features used | 7 |
| 19 | days_active_in_period | SMALLINT | NO | 0 | Days with at least one action | 4 |
| 20 | previous_period_score | REAL | YES | NULL | Activity score from prior period | 68.0 |
| 21 | score_change | REAL | YES | NULL | activity_score - previous_period_score | 4.5 |
| 22 | metadata | JSONB | NO | '{}' | Model version, feature weights | {"model_version":"v2"} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (user_id, period_type, period_start)   — one row per user per period
FK: user_id → USERS.id ON DELETE CASCADE
CHECK (period_type IN ('daily','weekly','monthly'))
CHECK (activity_score BETWEEN 0 AND 100)
CHECK (retention_risk_score BETWEEN 0 AND 1)
CHECK (retention_risk_tier IN ('low','medium','high','critical'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_ues_user_period | user_id, period_type, period_start DESC | BTREE | User score history |
| idx_ues_risk | retention_risk_tier, period_type, period_start | BTREE | At-risk user cohorts |
| idx_ues_period | period_type, period_start DESC | BTREE | Cohort analytics by period |

**Partition strategy**: RANGE by `period_start`, yearly.

**Example row**:
```json
{
  "id": "clxues001",
  "user_id": "clx9abc123def",
  "period_type": "weekly",
  "period_start": "2026-04-14",
  "period_end": "2026-04-20",
  "activity_score": 72.5,
  "retention_risk_score": 0.18,
  "retention_risk_tier": "low",
  "rooms_joined": 5,
  "watch_time_seconds": 18000,
  "days_active_in_period": 4
}
```

---

### FEATURE_USAGE

**Purpose**: Which features each user has discovered, adopted, and continued using — first use, last use, use count, and adoption/drop state.

**Write frequency**: Low — upserted when a feature is used
**Read frequency**: Medium — feature adoption dashboards, onboarding triggers
**Retention**: Forever
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxfus001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | feature_name | TEXT | NO | — | call / reactions / invite_link / invite_code / chat / co_host / host_controls / theater_mode / fullscreen / keyboard_shortcuts / speed_control / quality_control / subtitle_control / loop / autoplay / miniplayer | call |
| 4 | first_used_at | TIMESTAMPTZ | NO | now() | First ever use | 2026-01-20T15:00:00Z |
| 5 | last_used_at | TIMESTAMPTZ | NO | now() | Most recent use | 2026-04-18T08:06:00Z |
| 6 | use_count | INTEGER | NO | 1 | Total lifetime uses | 24 |
| 7 | adopted | BOOLEAN | NO | false | Used 3+ times (adoption threshold) | true |
| 8 | adoption_date | TIMESTAMPTZ | YES | NULL | When adoption threshold was crossed | 2026-02-01T10:00:00Z |
| 9 | dropped | BOOLEAN | NO | false | Not used in last 30 days | false |
| 10 | drop_date | TIMESTAMPTZ | YES | NULL | When drop was detected | NULL |
| 11 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (user_id, feature_name)   — one row per feature per user
FK: user_id → USERS.id ON DELETE CASCADE
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_fus_user | user_id, feature_name | BTREE | User feature status |
| idx_fus_feature | feature_name, adopted | BTREE | Adoption rate per feature |
| idx_fus_dropped | dropped, last_used_at | BTREE | Re-engagement campaigns |

**Partition strategy**: None. Bounded by users × feature_count.

**Example row**:
```json
{
  "id": "clxfus001",
  "user_id": "clx9abc123def",
  "feature_name": "call",
  "first_used_at": "2026-01-20T15:00:00Z",
  "last_used_at": "2026-04-18T08:06:00Z",
  "use_count": 24,
  "adopted": true,
  "adoption_date": "2026-02-01T10:00:00Z",
  "dropped": false
}
```

---

### USER_REFERRALS

**Purpose**: Who invited whom — the full referral chain, invite method, conversion state, and time-to-convert.

**Write frequency**: Low — one row per referral event
**Read frequency**: Low — growth analytics, referral program reporting
**Retention**: Forever — viral loop data
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxurf001 |
| 2 | referrer_user_id | TEXT | NO | — | FK → USERS; who sent the invite | clx9abc123def |
| 3 | referred_user_id | TEXT | NO | — | FK → USERS; who was invited | clxuser999 |
| 4 | invite_token_id | TEXT | YES | NULL | FK → INVITE_TOKENS | clxinv789 |
| 5 | room_id | TEXT | YES | NULL | FK → ROOMS; which room invite was for | clxroom001 |
| 6 | invite_method | TEXT | NO | — | link / code / direct_share | link |
| 7 | referral_at | TIMESTAMPTZ | NO | now() | When referral was established (user registered via invite) | 2026-03-01T14:00:00Z |
| 8 | converted | BOOLEAN | NO | false | Referred user became active (joined a room) | true |
| 9 | conversion_at | TIMESTAMPTZ | YES | NULL | When conversion occurred | 2026-03-01T14:15:00Z |
| 10 | time_to_convert_seconds | INTEGER | YES | NULL | Seconds from referral to first room join | 900 |
| 11 | referred_user_is_active | BOOLEAN | NO | false | Currently active (updated weekly) | true |
| 12 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
UNIQUE (referrer_user_id, referred_user_id)   — one referral record per pair
FK: referrer_user_id → USERS.id ON DELETE RESTRICT
FK: referred_user_id → USERS.id ON DELETE CASCADE
FK: invite_token_id → INVITE_TOKENS.id ON DELETE SET NULL
FK: room_id → ROOMS.id ON DELETE SET NULL
CHECK (invite_method IN ('link','code','direct_share'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_urf_referrer | referrer_user_id, converted | BTREE | Referrer conversion rate |
| idx_urf_referred | referred_user_id | BTREE | How a user was acquired |
| idx_urf_invite_method | invite_method, converted | BTREE | Link vs code conversion |

**Partition strategy**: None.

**Example row**:
```json
{
  "id": "clxurf001",
  "referrer_user_id": "clx9abc123def",
  "referred_user_id": "clxuser999",
  "invite_method": "link",
  "referral_at": "2026-03-01T14:00:00Z",
  "converted": true,
  "conversion_at": "2026-03-01T14:15:00Z",
  "time_to_convert_seconds": 900
}
```

---

### ROOM_DISCOVERY

**Purpose**: How users find and arrive at rooms — discovery method, source, and whether discovery led to a join.

**Write frequency**: Low — on every room page view or join attempt
**Read frequency**: Low — growth analytics, invite channel effectiveness
**Retention**: 1 year
**PII**: NO

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxrdc001 |
| 2 | user_id | TEXT | YES | NULL | FK → USERS; NULL if unauthenticated | clx9abc123def |
| 3 | room_id | TEXT | NO | — | FK → ROOMS | clxroom001 |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | discovered_at | TIMESTAMPTZ | NO | now() | When room was discovered | 2026-04-18T08:04:00Z |
| 6 | discovery_method | TEXT | NO | — | direct_link / invite_link / invite_code / member_share / browser_notification / email / organic | invite_link |
| 7 | invite_token_id | TEXT | YES | NULL | FK → INVITE_TOKENS | clxinv789 |
| 8 | source_url_hash | TEXT | YES | NULL | SHA-256 of the referring URL | 8f3a9c... |
| 9 | converted_to_join | BOOLEAN | NO | false | Did user join the room? | true |
| 10 | join_latency_seconds | INTEGER | YES | NULL | Seconds from discovery to room join | 60 |
| 11 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE SET NULL
FK: room_id → ROOMS.id ON DELETE CASCADE
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
FK: invite_token_id → INVITE_TOKENS.id ON DELETE SET NULL
CHECK (discovery_method IN ('direct_link','invite_link','invite_code','member_share','browser_notification','email','organic'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_rdc_room | room_id, discovered_at | BTREE | Room discovery funnel |
| idx_rdc_method | discovery_method, converted_to_join | BTREE | Channel conversion rates |

**Partition strategy**: RANGE by `discovered_at`, monthly.

**Example row**:
```json
{
  "id": "clxrdc001",
  "user_id": "clx9abc123def",
  "room_id": "clxroom001",
  "discovered_at": "2026-04-18T08:04:00Z",
  "discovery_method": "invite_link",
  "converted_to_join": true,
  "join_latency_seconds": 60
}
```

---

## Group 8 — Infrastructure, Security, Compliance

---

### AUDIT_LOG

**Purpose**: Append-only immutable record of every sensitive action on the platform — account changes, auth events, moderation actions, admin operations, data exports.

**Write frequency**: Medium — on every sensitive action
**Read frequency**: Low — security investigations, compliance audits
**Retention**: 7 years (legal/compliance requirement)
**PII**: YES — `ip_address`, `before_state` and `after_state` may contain PII

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxaud001 |
| 2 | occurred_at | TIMESTAMPTZ | NO | now() | When the action occurred | 2026-04-18T08:00:00Z |
| 3 | actor_user_id | TEXT | YES | NULL | FK → USERS; NULL for system actions | clx9abc123def |
| 4 | actor_type | TEXT | NO | — | user / admin / system / api | user |
| 5 | target_user_id | TEXT | YES | NULL | FK → USERS; affected user | NULL |
| 6 | target_entity_type | TEXT | YES | NULL | user / room / message / invite / device / oauth_connection / session | user |
| 7 | target_entity_id | TEXT | YES | NULL | ID of affected entity | clx9abc123def |
| 8 | action | TEXT | NO | — | Namespaced action: user.created / user.email_verified / user.suspended / user.deleted / room.created / room.ended / room.member_removed / message.deleted / auth.password_changed / auth.password_reset / auth.2fa_enabled / auth.session_revoked / auth.oauth_connected / auth.oauth_disconnected / gdpr.export_requested / gdpr.deletion_requested / admin.user_suspended / admin.room_closed | user.email_verified |
| 9 | ip_address | INET | YES | NULL | IP of actor **(PII)** | 192.168.1.1 |
| 10 | user_agent | TEXT | YES | NULL | UA of actor | Mozilla/5.0... |
| 11 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS (soft ref — no FK constraint) | clxses001 |
| 12 | before_state | JSONB | YES | NULL | Entity state before action **(may contain PII)** | {"account_status":"active"} |
| 13 | after_state | JSONB | YES | NULL | Entity state after action **(may contain PII)** | {"account_status":"suspended"} |
| 14 | result | TEXT | NO | 'success' | success / failure / partial | success |
| 15 | failure_reason | TEXT | YES | NULL | Why action failed | NULL |
| 16 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: actor_user_id → USERS.id ON DELETE SET NULL
FK: target_user_id → USERS.id ON DELETE SET NULL
CHECK (actor_type IN ('user','admin','system','api'))
CHECK (result IN ('success','failure','partial'))
-- NO UPDATE or DELETE allowed — enforce via PostgreSQL row security or trigger
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_aud_actor | actor_user_id, occurred_at DESC | BTREE | Actor action history |
| idx_aud_target | target_user_id, occurred_at DESC | BTREE | Actions taken on a user |
| idx_aud_action | action, occurred_at DESC | BTREE | Action type frequency |
| idx_aud_occurred | occurred_at DESC | BTREE | Time-range audit queries |

**Partition strategy**: RANGE by `occurred_at`, monthly. Archive to cold storage after 1 year but retain for 7 years for compliance.

**Example row**:
```json
{
  "id": "clxaud001",
  "occurred_at": "2026-04-18T08:00:00Z",
  "actor_user_id": "clx9abc123def",
  "actor_type": "user",
  "target_entity_type": "user",
  "target_entity_id": "clx9abc123def",
  "action": "auth.password_changed",
  "ip_address": "192.168.1.1",
  "before_state": null,
  "after_state": {"password_changed_at": "2026-04-18T08:00:00Z"},
  "result": "success"
}
```

**Developer notes**: NEVER run UPDATE or DELETE on this table. Enforce with a PostgreSQL trigger that raises an exception on any UPDATE/DELETE attempt. `before_state` and `after_state` should never contain passwords, tokens, or full PII dumps — only the fields relevant to the specific action. Apply a PostgreSQL row-level security policy if table is exposed to less-privileged service roles.

---

### RATE_LIMIT_EVENTS

**Purpose**: Every rate limit breach — who hit it, which endpoint, which window, what action was taken.

**Write frequency**: Low-medium — on rate limit hits (high when under attack)
**Read frequency**: Low — security monitoring, incident response
**Retention**: 90 days
**PII**: YES — `ip_address`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxrle001 |
| 2 | occurred_at | TIMESTAMPTZ | NO | now() | When limit was hit | 2026-04-18T08:00:00Z |
| 3 | user_id | TEXT | YES | NULL | FK → USERS; NULL for unauthenticated | clx9abc123def |
| 4 | ip_address | INET | NO | — | Client IP **(PII)** | 192.168.1.1 |
| 5 | endpoint | TEXT | NO | — | API endpoint that was rate limited | /api/auth/login |
| 6 | method | TEXT | NO | — | HTTP method | POST |
| 7 | window_type | TEXT | NO | — | per_minute / per_hour / per_day | per_minute |
| 8 | window_start | TIMESTAMPTZ | NO | — | Start of the rate limit window | 2026-04-18T08:00:00Z |
| 9 | request_count_in_window | INTEGER | NO | — | Requests counted in this window | 62 |
| 10 | limit_threshold | INTEGER | NO | — | The limit that was exceeded | 60 |
| 11 | action_taken | TEXT | NO | — | warned / blocked / challenged | blocked |
| 12 | is_blocked | BOOLEAN | NO | false | Whether request was rejected | true |
| 13 | block_duration_seconds | INTEGER | YES | NULL | How long block lasts | 300 |
| 14 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE SET NULL
CHECK (window_type IN ('per_minute','per_hour','per_day'))
CHECK (action_taken IN ('warned','blocked','challenged'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_rle_ip_time | ip_address, occurred_at DESC | BTREE | IP-level rate limit analysis |
| idx_rle_user | user_id, occurred_at | BTREE | Per-user limit history |
| idx_rle_endpoint | endpoint, occurred_at | BTREE | Endpoint rate limit monitoring |

**Partition strategy**: RANGE by `occurred_at`, monthly. Drop after 90 days.

**Example row**:
```json
{
  "id": "clxrle001",
  "occurred_at": "2026-04-18T08:00:00Z",
  "ip_address": "192.168.1.1",
  "endpoint": "/api/auth/login",
  "method": "POST",
  "window_type": "per_minute",
  "request_count_in_window": 62,
  "limit_threshold": 60,
  "action_taken": "blocked",
  "is_blocked": true,
  "block_duration_seconds": 300
}
```

---

### ERROR_EVENTS

**Purpose**: Every error that reaches a user — type, severity, context, user impact, and resolution state.

**Write frequency**: Low-medium — on user-facing errors
**Read frequency**: Low — engineering dashboards, incident response
**Retention**: 1 year
**PII**: NO — stack traces hashed; error messages sanitized before storage

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxerr001 |
| 2 | occurred_at | TIMESTAMPTZ | NO | now() | When error occurred | 2026-04-18T08:10:00Z |
| 3 | user_id | TEXT | YES | NULL | FK → USERS | clx9abc123def |
| 4 | session_id | TEXT | YES | NULL | FK → USER_SESSIONS | clxses001 |
| 5 | room_id | TEXT | YES | NULL | FK → ROOMS | clxroom001 |
| 6 | error_type | TEXT | NO | — | ws_error / sync_error / overlay_error / api_error / auth_error / extension_error / video_error / call_error | ws_error |
| 7 | error_code | TEXT | YES | NULL | Application-specific error code | WS_1006 |
| 8 | error_message | TEXT | YES | NULL | Sanitized error message (no PII) | WebSocket connection closed unexpectedly |
| 9 | stack_trace_hash | TEXT | YES | NULL | SHA-256 of stack trace for grouping | 7c3f9a... |
| 10 | source | TEXT | NO | — | client / server / extension | extension |
| 11 | severity | TEXT | NO | 'error' | info / warning / error / critical | error |
| 12 | user_impact | TEXT | NO | 'none' | none / degraded / blocked / data_loss | degraded |
| 13 | was_retried | BOOLEAN | NO | false | Was the operation retried | true |
| 14 | retry_count | SMALLINT | NO | 0 | Number of retry attempts | 3 |
| 15 | was_resolved | BOOLEAN | YES | NULL | Did error self-resolve | true |
| 16 | resolution_ms | INTEGER | YES | NULL | Time to resolution in ms | 2000 |
| 17 | browser | TEXT | YES | NULL | Browser name | Chrome |
| 18 | browser_version | TEXT | YES | NULL | Browser version | 124.0.0.0 |
| 19 | extension_version | TEXT | YES | NULL | Extension version | 1.4.2 |
| 20 | os | TEXT | YES | NULL | OS name | macOS |
| 21 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE SET NULL
FK: session_id → USER_SESSIONS.id ON DELETE SET NULL
FK: room_id → ROOMS.id ON DELETE SET NULL
CHECK (source IN ('client','server','extension'))
CHECK (severity IN ('info','warning','error','critical'))
CHECK (user_impact IN ('none','degraded','blocked','data_loss'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_err_type_time | error_type, occurred_at DESC | BTREE | Error type frequency |
| idx_err_hash | stack_trace_hash, occurred_at | BTREE | Group errors by stack |
| idx_err_severity | severity, occurred_at | BTREE | Critical error monitoring |
| idx_err_version | extension_version, error_type | BTREE | Errors per extension version |

**Partition strategy**: RANGE by `occurred_at`, monthly.

**Example row**:
```json
{
  "id": "clxerr001",
  "occurred_at": "2026-04-18T08:10:00Z",
  "error_type": "ws_error",
  "error_code": "WS_1006",
  "error_message": "WebSocket connection closed unexpectedly",
  "source": "extension",
  "severity": "error",
  "user_impact": "degraded",
  "was_retried": true,
  "retry_count": 3,
  "was_resolved": true,
  "resolution_ms": 2000,
  "extension_version": "1.4.2"
}
```

---

### DATA_EXPORT_REQUESTS

**Purpose**: GDPR Article 20 compliance — every data export request, processing state, delivery, and associated deletion request.

**Write frequency**: Very low — rare user action
**Read frequency**: Low — compliance dashboard, export processing jobs
**Retention**: 7 years (legal requirement)
**PII**: YES — `request_ip`

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxder001 |
| 2 | user_id | TEXT | NO | — | FK → USERS | clx9abc123def |
| 3 | requested_at | TIMESTAMPTZ | NO | now() | When request was submitted | 2026-04-18T08:00:00Z |
| 4 | request_ip | INET | NO | — | IP that submitted request **(PII)** | 192.168.1.1 |
| 5 | status | TEXT | NO | 'pending' | pending / processing / completed / failed / expired | completed |
| 6 | data_categories | TEXT[] | NO | '{}' | What was included: profile / rooms / messages / events / all | {all} |
| 7 | processing_started_at | TIMESTAMPTZ | YES | NULL | When job began | 2026-04-18T08:05:00Z |
| 8 | completed_at | TIMESTAMPTZ | YES | NULL | When export was ready | 2026-04-18T08:10:00Z |
| 9 | download_url_hash | TEXT | YES | NULL | SHA-256 of signed download URL | 9a3f7c... |
| 10 | expires_at | TIMESTAMPTZ | YES | NULL | When download link expires | 2026-04-25T08:10:00Z |
| 11 | downloaded | BOOLEAN | NO | false | Whether user downloaded the file | true |
| 12 | downloaded_at | TIMESTAMPTZ | YES | NULL | Download timestamp | 2026-04-18T08:15:00Z |
| 13 | download_count | SMALLINT | NO | 0 | Number of times downloaded | 1 |
| 14 | deletion_requested_at | TIMESTAMPTZ | YES | NULL | If user also requested deletion | NULL |
| 15 | deletion_completed_at | TIMESTAMPTZ | YES | NULL | When deletion was processed | NULL |
| 16 | notes | TEXT | YES | NULL | Internal ops notes | NULL |
| 17 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
FK: user_id → USERS.id ON DELETE RESTRICT   — must process export before deleting user
CHECK (status IN ('pending','processing','completed','failed','expired'))
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_der_user | user_id, requested_at | BTREE | User export history |
| idx_der_status | status, requested_at | BTREE | Processing queue |

**Partition strategy**: None. Very low volume.

**Example row**:
```json
{
  "id": "clxder001",
  "user_id": "clx9abc123def",
  "requested_at": "2026-04-18T08:00:00Z",
  "status": "completed",
  "data_categories": ["all"],
  "completed_at": "2026-04-18T08:10:00Z",
  "downloaded": true,
  "download_count": 1
}
```

---

### WEBHOOK_EVENTS

**Purpose**: Every webhook sent to external integrations — payload, response, retry history, and final delivery state.

**Write frequency**: Low — on integration events (future feature)
**Read frequency**: Low — integration debugging, delivery monitoring
**Retention**: 90 days
**PII**: NO — payload is hashed

**Columns**:
| # | Column | PostgreSQL Type | Nullable | Default | Description | Example Value |
|---|--------|----------------|----------|---------|-------------|---------------|
| 1 | id | TEXT | NO | cuid() | Primary key | clxwhe001 |
| 2 | occurred_at | TIMESTAMPTZ | NO | now() | When event was triggered | 2026-04-18T08:00:00Z |
| 3 | event_type | TEXT | NO | — | room.created / room.ended / user.registered / message.deleted | room.ended |
| 4 | target_url_hash | TEXT | NO | — | SHA-256 of webhook endpoint URL | 3a9f7c... |
| 5 | integration_id | TEXT | YES | NULL | Which integration (future FK) | int_abc123 |
| 6 | payload_hash | TEXT | NO | — | SHA-256 of payload for dedup | 9c4a1b... |
| 7 | http_method | TEXT | NO | 'POST' | HTTP method | POST |
| 8 | response_code | SMALLINT | YES | NULL | HTTP response status | 200 |
| 9 | response_time_ms | INTEGER | YES | NULL | Round-trip time | 145 |
| 10 | attempt_number | SMALLINT | NO | 1 | Which delivery attempt (1-based) | 1 |
| 11 | max_attempts | SMALLINT | NO | 5 | Maximum retries configured | 5 |
| 12 | final_status | TEXT | YES | NULL | delivered / failed / abandoned | delivered |
| 13 | first_attempted_at | TIMESTAMPTZ | NO | now() | First delivery attempt | 2026-04-18T08:00:00Z |
| 14 | last_attempted_at | TIMESTAMPTZ | YES | NULL | Most recent attempt | 2026-04-18T08:00:00Z |
| 15 | next_retry_at | TIMESTAMPTZ | YES | NULL | Scheduled next retry | NULL |
| 16 | failure_reason | TEXT | YES | NULL | timeout / connection_refused / non_2xx / etc. | NULL |
| 17 | metadata | JSONB | NO | '{}' | Extensible | {} |

**Constraints**:
```
PRIMARY KEY (id)
CHECK (final_status IN ('delivered','failed','abandoned') OR final_status IS NULL)
```

**Indexes**:
| Index Name | Columns | Type | Query it serves |
|------------|---------|------|-----------------|
| idx_whe_status | final_status, occurred_at | BTREE | Delivery monitoring |
| idx_whe_retry | next_retry_at, final_status | BTREE | Retry job queue |
| idx_whe_event_type | event_type, occurred_at | BTREE | Event type delivery stats |

**Partition strategy**: RANGE by `occurred_at`, monthly. Drop after 90 days.

**Example row**:
```json
{
  "id": "clxwhe001",
  "event_type": "room.ended",
  "payload_hash": "9c4a1b2d...",
  "response_code": 200,
  "response_time_ms": 145,
  "attempt_number": 1,
  "final_status": "delivered",
  "first_attempted_at": "2026-04-18T08:00:00Z"
}
```


---

## Redis Keys Reference

| Key Pattern | Type | TTL | Written By | Read By | On Expiry | Example Value |
|-------------|------|-----|-----------|---------|-----------|---------------|
| `session:{token_hash}` | Hash | 30 days (sliding) | Auth service on login/refresh | Every authenticated API request | Session invalidated — user must re-login | `{user_id, expires_at, device_id, auth_method}` |
| `room:{room_id}:state` | Hash | 24h after last activity | Room service on join/leave/sync | Sync engine, member list API | Room considered inactive | `{status, member_count, current_video_id, host_user_id, platform}` |
| `room:{room_id}:members` | Set | 24h after last activity | Room service on join/leave | Broadcast engine, presence API | All members considered offline | `{user_id_1, user_id_2, ...}` |
| `room:{room_id}:sync` | Hash | 24h | Sync engine on every sync event | Sync engine, snapshot job | Sync state lost — next event rebuilds | `{position_s, playing, speed, last_event_id, last_event_at}` |
| `room:{room_id}:member_positions` | Hash | 24h | Sync engine per member position update | Snapshot job (every 30s), host dashboard | Drift data lost | `{user_id: position_s, ...}` |
| `room:{room_id}:typing` | Set | — | Extension on typing start (add user); expire individual members with EXPIREAT | Chat panel presence | Empty set = no one typing | `{user_id_1}` (set members each have individual TTL of 3s) |
| `room:{room_id}:messages:recent` | List | 24h | Message service on every send | Chat panel on join (load last 50 messages) | Lost; client fetches from PostgreSQL | `[{id, user_id, content, created_at, ...}, ...]` (capped at 100) |
| `room:{room_id}:reactions:queue` | List | 1h | Extension on every video reaction | Reaction broadcaster | Undelivered reactions dropped | `[{emoji, user_id, position_s, at}, ...]` |
| `room:{room_id}:call` | Hash | 24h | Call service on call start/end | Room state API, overlay | Call considered ended | `{call_session_id, participant_count, daily_room_url}` |
| `room:code:{code}` | String | Permanent while active | Room service on room creation | Room join endpoint | N/A | `clxroom001` (room_id) |
| `user:{user_id}:online` | String | 90s (sliding heartbeat) | Extension heartbeat (every 60s) | Presence API | User marked offline | `{session_id, room_id}` |
| `user:{user_id}:ws_connection` | String | Sliding | WS gateway on connect | Broadcast router | WS considered dead | `{connection_id, server_id}` |
| `ws:conn:{connection_id}` | Hash | Sliding | WS gateway on connect | WS broadcast engine | Connection cleaned up | `{user_id, room_id, session_id, connected_at}` |
| `invite:{token}:meta` | Hash | 1h (cache) | Invite service on creation/use | Room join endpoint | Fetches from PostgreSQL | `{room_id, status, use_count, max_uses, expires_at, role_granted}` |
| `rate:{type}:{identifier}:{window}` | String | Window duration | Rate limit middleware on every request | Rate limit middleware | Counter resets naturally | `62` (request count) |
| `verify:cooldown:{user_id}` | String | 60s | Email verification service on resend | Email verification endpoint | Cooldown lifted; new resend allowed | `1` (flag) |
| `reset:cooldown:{ip}` | String | 300s | Password reset service | Password reset endpoint | Cooldown lifted | `3` (request count) |
| `room:{room_id}:broadcast:pending` | Stream | 1h | Any service publishing a room event | Broadcast worker | Events expired before delivery — log | Stream entries with event type, payload |
| `feature_flags` | Hash | No expiry | Admin dashboard | Every request (cached locally 60s) | N/A | `{enable_call: "true", max_room_size: "20"}` |
| `metrics:active_rooms` | String | No expiry | Room service on open/close | Admin dashboard | N/A | `142` |
| `metrics:active_users` | String | No expiry | Heartbeat updates | Admin dashboard | N/A | `1847` |

---

## Relationships Diagram

```
USERS ─────────────────────────────────────────────────────────────────────────
  │  hosts many           ROOMS ──────────────────────────────────────────────
  │  ─────────────────────── │                                                 │
  │                           │ has many ROOM_MEMBERS ◄──── INVITE_TOKENS       │
  │  joins as member ─────────┤         │                        │              │
  │                           │         └── ROOM_MEMBER_ROLE_HISTORY             │
  │  has many USER_SESSIONS   │                                                  │
  │         │                 │ has many ROOM_VIDEOS                             │
  │         │                 │         │                                        │
  │  has many USER_DEVICES    │         └── SYNC_EVENTS                          │
  │                           │         └── SYNC_QUALITY_SNAPSHOTS               │
  │  has OAUTH_CONNECTIONS    │         └── BUFFER_EVENTS (per user+room)        │
  │                           │                                                  │
  │  AUTH TABLES:             │ has many MESSAGES ──── MESSAGE_REACTIONS         │
  │  EMAIL_VERIFICATION_TOKENS│         │                                        │
  │  PASSWORD_RESET_TOKENS    │ has many VIDEO_REACTIONS                         │
  │  LOGIN_ATTEMPTS           │ has many TYPING_INDICATORS                       │
  │                           │                                                  │
  │  BEHAVIOR TABLES          │ has CALL_SESSIONS ──── CALL_PARTICIPANTS         │
  │  (all FK → USERS):        │                │                                 │
  │  USER_VIDEO_INTERACTIONS  │                └── CALL_QUALITY_EVENTS           │
  │  USER_PAGE_INTERACTIONS   │                                                  │
  │  USER_OVERLAY_INTERACTIONS│ ANALYTICS:                                       │
  │  USER_TAB_EVENTS          │ ROOM_SESSIONS_SUMMARY (1:1 per room)             │
  │  USER_SCROLL_EVENTS       │                                                  │
  │  USER_CURSOR_EVENTS       └────────────────────────────────────────────────  │
  │  USER_KEYBOARD_EVENTS                                                        │
  │  USER_NETWORK_EVENTS      USERS also relate to:                              │
  │  USER_EXTENSION_EVENTS    USER_WATCH_HISTORY ─────────────► ROOM_VIDEOS      │
  │                           USER_ENGAGEMENT_SCORES                             │
  │                           USER_REFERRALS (referrer + referred)               │
  │                           FEATURE_USAGE                                      │
  │                           ROOM_DISCOVERY                                     │
  │                                                                              │
  └──► AUDIT_LOG (actor_user_id + target_user_id)                               │
       RATE_LIMIT_EVENTS                                                         │
       ERROR_EVENTS                                                              │
       DATA_EXPORT_REQUESTS                                                      │

CORE CHAIN: USERS → ROOMS → ROOM_MEMBERS → ROOM_VIDEOS → SYNC_EVENTS
SOCIAL CHAIN: ROOMS → MESSAGES → MESSAGE_REACTIONS / VIDEO_REACTIONS
CALL CHAIN: ROOMS → CALL_SESSIONS → CALL_PARTICIPANTS → CALL_QUALITY_EVENTS
GROWTH CHAIN: INVITE_TOKENS → ROOM_MEMBERS → USER_REFERRALS → USER_ENGAGEMENT_SCORES
```

---

## Design Decisions

### 1. cuid() over UUID for primary keys
**Decision**: All IDs use cuid2 (compact, URL-safe, collision-resistant, k-sortable).
**Why**: UUIDs (v4) are 36-char strings, non-sortable, and cause index fragmentation. cuid2 is shorter, safe for URLs without encoding, and approximately sortable by insertion time — useful for debugging and pagination.
**Trade-off**: Not a standard; adds a library dependency. Acceptable because the format is stable and the benefits outweigh the standardization cost.

### 2. TEXT over VARCHAR(n) for all string columns
**Decision**: No character length limits on string columns in PostgreSQL (use TEXT).
**Why**: PostgreSQL stores TEXT and VARCHAR(n) identically. VARCHAR(n) adds a constraint that can cause application errors if a value is longer than expected. Validation belongs in the application layer, not the database schema.

### 3. Token hashes, never raw tokens
**Decision**: All tokens (session, verify, reset, OAuth) are stored as SHA-256 hashes. Raw tokens live in memory only.
**Why**: Defense-in-depth. Even if the database is compromised, attackers cannot use token hashes directly. Raw token is compared by hashing the incoming value and comparing against the stored hash.

### 4. TIMESTAMPTZ everywhere, UTC storage
**Decision**: All timestamp columns are TIMESTAMPTZ; all values stored in UTC.
**Why**: TIMESTAMPTZ stores the UTC moment with time zone awareness. Avoids daylight saving bugs when reading timestamps in different time zones. Application layer converts to user's timezone for display.

### 5. Separate BUFFER_EVENTS table (not in SYNC_EVENTS)
**Decision**: Buffer events have their own table with a shorter retention period (60 days vs 6 months for sync events).
**Why**: Buffer events are 10–50× more frequent than sync events. Mixing them would bloat SYNC_EVENTS and complicate retention policies. Separate table allows weekly partitioning and aggressive archival without affecting sync data.

### 6. Denormalized counters on ROOMS and ROOM_MEMBERS
**Decision**: `current_member_count`, `total_messages`, `reactions_sent`, etc. are maintained as denormalized counters.
**Why**: A room with 500 messages and 10 members would require expensive COUNT queries on every page load. Counters are updated in the same transaction as the source write. Small risk of drift on crash — reconcile nightly with a correction job.

### 7. JSONB `metadata` column on every table
**Decision**: Every table has a `metadata JSONB NOT NULL DEFAULT '{}'` column.
**Why**: Product requirements change. Adding columns to large partitioned tables requires careful migration. The `metadata` column acts as a schemaless escape hatch for fields that don't yet warrant a typed column. Fields that graduate to frequent use get promoted to typed columns.

### 8. Monthly partitioning for high-volume event tables
**Decision**: SYNC_EVENTS, USER_VIDEO_INTERACTIONS, MESSAGES, AUDIT_LOG, and others are partitioned by month using RANGE on their primary timestamp.
**Why**: Enables efficient range scans (queries scoped to a month touch only one partition), fast partition DROP for archival (no DELETE needed), and reduced vacuum overhead. The cost is added complexity in migrations and queries that span partition boundaries.

### 9. Append-only AUDIT_LOG with trigger enforcement
**Decision**: AUDIT_LOG has no UPDATE or DELETE allowed — enforced by a PostgreSQL trigger that raises an exception.
**Why**: An audit log that can be modified is not an audit log. Immutability is the security property. The trigger ensures no application bug or manual query can accidentally modify audit records.

### 10. IP addresses stored as INET, not TEXT
**Decision**: All IP address columns use PostgreSQL INET type.
**Why**: INET enables subnet queries (`WHERE ip_address << '192.168.0.0/16'`), proper indexing, and built-in validation. TEXT storage would require application-side parsing for every query involving IP ranges.

### 11. Soft deletes everywhere (never hard-delete user content)
**Decision**: Messages, users, and rooms are soft-deleted (`deleted_at` timestamp, `status` field) — never physically removed via DELETE.
**Why**: Hard deletes make audit trails incomplete. Moderation needs to see what was deleted. GDPR deletion is handled by nullifying PII fields, not deleting rows. Rows can be physically removed via archival jobs after the legal retention period.

### 12. Platform-agnostic schema from day one
**Decision**: ROOMS has a `platform` column; ROOM_VIDEOS has `platform` and `platform_video_id`. No YouTube-specific columns are named YouTube.
**Why**: Netflix/Prime/Disney+ support is planned for Phase 2. Building the schema with a `platform` discriminator from day one means no ALTER TABLE migrations when other platforms ship. Adding platform-specific metadata goes into the `metadata` JSONB.

### 13. email_hash alongside raw email in USERS and LOGIN_ATTEMPTS
**Decision**: Both tables include a `SHA-256(lowercase(email))` hash column alongside the raw email.
**Why**: Analytics queries (e.g., "how many failed attempts for this email hash?") should never require a table scan on raw PII. The hash column enables safe analytics joins — in future, raw email can be scrubbed while hash remains for correlation.

### 14. Behavior tables separate from core tables
**Decision**: USER_VIDEO_INTERACTIONS, USER_SCROLL_EVENTS, USER_CURSOR_EVENTS etc. are in their own tables, not in USER_SESSIONS or ROOMS.
**Why**: These tables will have 100M–1B+ rows within the first year. Mixing them with lower-volume tables would make both harder to manage. Separate tables allow independent partitioning strategies and different retention windows.

### 15. Role history in a separate ROOM_MEMBER_ROLE_HISTORY table
**Decision**: Role changes are logged in a dedicated table rather than in ROOM_MEMBERS.
**Why**: If role history were in ROOM_MEMBERS as an array/JSONB, the row would grow unbounded and make reads/writes slower. A separate append-only table keeps ROOM_MEMBERS clean for hot-path operations while providing full audit history.

### 16. SMALLINT for bounded counters
**Decision**: Columns like `member_count`, `retry_count`, `attempt_count` use SMALLINT (max 32,767).
**Why**: Saves 2 bytes per row vs INTEGER at the scale of billions of event rows. These values are genuinely bounded (a room won't have 32k members; a token won't have 32k attempts). Use INTEGER only where values could legitimately exceed 32k.

### 17. Composite index strategy for event tables
**Decision**: Event tables index `(entity_id, timestamp DESC)` rather than timestamp alone.
**Why**: The most common query pattern is "all events for room X in the last hour" — this scans only the relevant partition and uses the composite index to avoid full partition scans. Timestamp-only indexes would be useful for global analytics but not for per-entity queries.

### 18. Cursor and scroll events may bypass PostgreSQL
**Decision**: USER_CURSOR_EVENTS and USER_SCROLL_EVENTS are noted as candidates for a dedicated time-series store (InfluxDB, Timestream) rather than PostgreSQL.
**Why**: At 1M users, cursor events at 1/250ms = 4/sec per active user. With 10k concurrent users, that's 40k rows/sec — 3.5B rows/day. PostgreSQL can handle this with aggressive partitioning, but a columnar time-series store would be 10–100× more efficient for the heatmap queries these tables serve.

### 19. `geographic_distribution` as JSONB on ROOMS
**Decision**: Member country distribution is stored as `{country_code: count}` JSONB, not in a junction table.
**Why**: This field is append-only (merge keys on join) and is read as a whole unit for display. A junction table would require a GROUP BY query every time. The JSONB approach is a read optimization — JSONB merge is atomic with a `jsonb_set` call.

### 20. Feature flags in Redis, not PostgreSQL
**Decision**: `feature_flags` is a Redis Hash, not a database table (no FEATURE_FLAGS table in schema).
**Why**: Feature flags are read on every request. Redis gives sub-millisecond reads at scale. PostgreSQL reads (even with connection pooling) add latency. Flags that need audit history are logged in AUDIT_LOG when changed. If flag complexity grows, evaluate a dedicated feature flag service (LaunchDarkly, GrowthBook).

---

## High Volume Tables

The following tables will exceed 1 million rows in the first year at 1M users:

| Table | Estimated Rows/Year | Partition Key | Partition Interval | Retention | Archive Strategy |
|-------|--------------------|--------------|--------------------|-----------|-----------------|
| USER_CURSOR_EVENTS | 50–500B | occurred_at | Weekly | 14 days | Drop partition | Consider InfluxDB |
| USER_SCROLL_EVENTS | 5–50B | occurred_at | Weekly | 30 days | Drop partition | Consider InfluxDB |
| USER_VIDEO_INTERACTIONS | 500M–2B | occurred_at | Monthly | 1 year | Archive to ClickHouse | Drop after archive |
| SYNC_EVENTS | 100M–500M | server_timestamp | Monthly | 6 months | Archive to BigQuery | Drop after archive |
| BUFFER_EVENTS | 50M–200M | started_at | Weekly | 60 days | Drop partition | |
| USER_OVERLAY_INTERACTIONS | 200M–1B | occurred_at | Monthly | 1 year | Archive to ClickHouse | |
| USER_TAB_EVENTS | 100M–500M | occurred_at | Monthly | 6 months | Drop partition | |
| USER_PAGE_INTERACTIONS | 100M–500M | occurred_at | Monthly | 6 months | Drop partition | |
| USER_EXTENSION_EVENTS | 50M–200M | occurred_at | Monthly | 1 year | Archive to ClickHouse | |
| USER_NETWORK_EVENTS | 50M–200M | occurred_at | Monthly | 6 months | Drop partition | |
| USER_KEYBOARD_EVENTS | 20M–100M | occurred_at | Monthly | 1 year | Archive to ClickHouse | |
| SYNC_QUALITY_SNAPSHOTS | 20M–100M | snapshot_at | Monthly | 3 months | Drop partition | |
| TYPING_INDICATORS | 10M–100M | started_at | Monthly | 90 days | Drop partition | |
| LOGIN_ATTEMPTS | 10M–50M | attempted_at | Monthly | 1 year | Archive then drop | |
| AUDIT_LOG | 10M–50M | occurred_at | Monthly | 7 years | Archive to cold storage | |
| USER_SESSIONS | 5M–50M | started_at | Monthly | 2 years | Archive to cold storage | |
| MESSAGES | 5M–50M | created_at | Monthly | 2 years | Archive to cold storage | |
| VIDEO_REACTIONS | 5M–20M | created_at | Monthly | 1 year | Archive to ClickHouse | |
| MESSAGE_REACTIONS | 2M–10M | created_at | Monthly | 2 years | Archive to cold storage | |
| ROOM_MEMBERS | 2M–10M | joined_at | Monthly | 2 years | Archive to cold storage | |

**Archival strategy for ClickHouse/BigQuery**: Nightly export job reads yesterday's closed partitions, converts to Parquet, uploads to object storage (S3/GCS), and loads into columnar store. Drop the PostgreSQL partition after confirming the columnar load succeeded. Run analytics queries against columnar store; run operational queries against PostgreSQL.

**Connection pooling requirement**: With this write volume, use PgBouncer in transaction mode between application servers and PostgreSQL. Target max 200 PostgreSQL connections.

---

## Column Extraction Capabilities

The following are example analytics questions and the tables/columns that answer them.

| # | Question | Tables / Columns |
|---|---------|-----------------|
| 1 | What % of users pause during the first 30 seconds of a video? | `USER_VIDEO_INTERACTIONS WHERE event_type = 'pause' AND video_position_seconds < 30` ÷ total users with video events |
| 2 | Which invite method converts better — link or code? | `INVITE_TOKENS.token_type` + `ROOM_MEMBERS.joined_at WHERE invite_token_id IS NOT NULL` — group by token_type, measure time-to-join and return rate |
| 3 | What is the average sync drift per platform? | `SYNC_EVENTS.avg_drift_before_ms` JOIN `ROOMS.platform` — GROUP BY platform |
| 4 | What % of rooms have at least one voice call? | `CALL_SESSIONS` ÷ `ROOMS` — WHERE rooms.status = 'ended' |
| 5 | Which emoji reactions are most popular at which video positions? | `VIDEO_REACTIONS.emoji_name, video_position_seconds` — GROUP BY emoji_name, FLOOR(video_position_seconds/10)*10 |
| 6 | What is the average time between message compose start and send? | `TYPING_INDICATORS.duration_ms WHERE outcome = 'sent'` — AVG, P50, P90 |
| 7 | What % of users return after their first room session? | `ROOM_MEMBERS` — users with `is_first_room = true` who have at least one additional `ROOM_MEMBERS` row |
| 8 | At what video position do most users leave a room? | `ROOM_MEMBERS.last_video_position` normalized by `ROOM_VIDEOS.duration_seconds` — distribution histogram |
| 9 | Which browsers have the highest buffer event rate? | `BUFFER_EVENTS` JOIN `USER_SESSIONS.browser` — buffer events per total watch time per browser |
| 10 | What is the most used keyboard shortcut in rooms? | `USER_KEYBOARD_EVENTS.shortcut_key WHERE room_id IS NOT NULL` — COUNT GROUP BY shortcut_key ORDER BY count DESC |
| 11 | Do users who join voice calls have higher room retention? | `CALL_PARTICIPANTS` JOIN `ROOM_MEMBERS.stayed_till_end` — compare stayed_till_end rate for call vs non-call members |
| 12 | What % of messages are sent in the first vs last 10% of a video? | `MESSAGES.video_position_seconds` vs `ROOM_VIDEOS.duration_seconds` — compare distribution in first and last decile |
| 13 | How many users abandon a message before sending? | `TYPING_INDICATORS WHERE outcome = 'abandoned'` ÷ all typing events — GROUP BY user cohort |
| 14 | What is the average extension popup open duration? | `USER_EXTENSION_EVENTS.popup_duration_ms WHERE event_type = 'popup_closed'` — AVG, P50, P90 by popup_state |
| 15 | Which countries have the worst sync drift? | `USER_SESSIONS.ip_country` JOIN `SYNC_EVENTS.avg_drift_before_ms` — GROUP BY ip_country |
| 16 | What is the correlation between message rate and room retention? | `ROOM_MEMBERS.messages_sent` vs `ROOM_MEMBERS.stayed_till_end` — Pearson correlation per room cohort |
| 17 | How many WebSocket reconnects happen per session on average? | `USER_EXTENSION_EVENTS WHERE event_type = 'ws_reconnect_success'` — COUNT per session_id, AVG |
| 18 | What % of users have changed playback speed at least once? | `USER_VIDEO_INTERACTIONS WHERE event_type = 'speed_change'` — DISTINCT user_id ÷ total active users |
| 19 | Which devices have the most sync quality issues? | `USER_DEVICES.browser, os` JOIN `SYNC_QUALITY_SNAPSHOTS.member_positions` — extract per-device avg drift |
| 20 | How long after signup does a new user host their first room? | `USERS.created_at` vs `ROOMS.created_at WHERE host_user_id = user_id` — MIN(rooms.created_at) - users.created_at |
| 21 | What is the average room size trend over time? | `ROOM_SESSIONS_SUMMARY.peak_member_count` GROUP BY DATE_TRUNC('week', started_at) |
| 22 | Which onboarding steps have the highest drop-off? | `USERS.onboarding_step WHERE onboarding_state = 'in_progress'` — COUNT per step, compare to total registrations |
| 23 | What % of invited users join within 5 minutes? | `ROOM_DISCOVERY.join_latency_seconds WHERE discovery_method IN ('invite_link','invite_code')` — % where join_latency_seconds < 300 |
| 24 | Do users with the extension on a second device have better retention? | `USER_DEVICES` (count devices where extension_installed = true per user) JOIN `USER_ENGAGEMENT_SCORES.activity_score` |
| 25 | What is the average compose time per message length bucket? | `TYPING_INDICATORS.duration_ms` JOIN `MESSAGES.char_count` (via created_at match) — GROUP BY NTILE(5) ON char_count |
| 26 | Which room size (member count) has the best host retention? | `ROOM_SESSIONS_SUMMARY.peak_member_count` bucket JOIN whether host created another room within 7 days |
| 27 | What % of buffer events occur on wifi vs mobile networks? | `BUFFER_EVENTS.connection_type` — COUNT GROUP BY connection_type ÷ total buffer events |
| 28 | How does sync drift change as room size increases? | `SYNC_QUALITY_SNAPSHOTS.average_drift_ms` vs `SYNC_QUALITY_SNAPSHOTS.member_count` — scatter/regression |
| 29 | What is the message send rate during the most-reacted video moments? | `VIDEO_REACTIONS.video_position_seconds` (peak moments) JOIN `MESSAGES.video_position_seconds` (nearby) — message rate at reaction peaks vs troughs |
| 30 | Which error types are most correlated with room abandonment? | `ERROR_EVENTS.error_type` JOIN `ROOM_MEMBERS.stayed_till_end = false` — % who left shortly after each error type |

