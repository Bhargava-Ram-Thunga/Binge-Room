# Monorepo Proofread and Audit Report (August 2026)

> **Scope:** M0 Architecture (15/15), M1 Foundation (25/25), M2 Rooms (5/12)  
> **Date:** 2026-08-23  
> **Target:** Monorepo proofread covering documentation, API contracts, database schema, error protocols, test suite integrity, issue hygiene, CI workflows, and root configuration.

---

## 1. Summary

A comprehensive proofread of all code, specifications, tests, workflows, and issue tracking across M0, M1, and in-progress M2 identified **9 total findings**: 0 Critical, 2 High, 3 Medium, and 4 Low severity. The repository foundation is robust: all 288+ unit/integration tests and 2 Playwright multi-browser E2E tests pass, typechecks (`tsc -b`) and linters pass cleanly, CI workflow dependencies are aligned, and issue milestones reflect actual delivered code. The two High-severity findings (architectural drift regarding extension WebSocket hosting between research docs and ADR-010, and ad-hoc error codes in `services/realtime/src/gateway.ts`) do not block immediate M2 completion work, because M2 focuses strictly on REST room lifecycle, settings, and authorization rather than realtime gateway error envelopes or extension bundling. However, both High-severity findings should be resolved before beginning M3 Realtime and M5 Generic Web Video implementation.

---

## 2. Findings Matrix

The findings below are ordered from highest to lowest severity:

| Area                   | File/Location                                                                                                                               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Severity   | Recommendation                                                                                                                                               |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Error Codes & Protocol | `services/realtime/src/gateway.ts` (lines 101, 114, 122, 128, 326, 341, 365, 378)                                                           | Realtime gateway error handling emits ad-hoc string literals (`RATE_LIMITED`, `INVALID_JSON`, `PROTOCOL_VALIDATION_FAILED`, `FORBIDDEN`) and hardcoded close codes (`4401`, `4400`) instead of importing and using canonical constants from `packages/protocol/src/errors.ts` (`ERROR_CODES`).                                                                                                                                                                       | **High**   | Import `ERROR_CODES` from `@huddly/protocol` into `gateway.ts` and ensure all error frames and disconnect reasons adhere to protocol envelope standards.     |
| Documentation Accuracy | `docs/research/browser-capability-matrix.md` (§3.1), `docs/audit/spec-audit.md` (§3.4) vs `docs/adr/ADR-010-extension-architecture.md` (§1) | `browser-capability-matrix.md` §3.1 and `spec-audit.md` §3.4 recommend that the web app tab maintain the WebSocket connection while the extension acts as a lightweight bridge. Conversely, `ADR-010` explicitly selected Option B, designating the extension Background Service Worker as the authoritative WebSocket client with a 20-second port keep-alive heartbeat.                                                                                            | **High**   | Update `docs/research/browser-capability-matrix.md` §3.1 and `docs/audit/spec-audit.md` §3.4 to align with the accepted architecture in `ADR-010`.           |
| API Documentation      | `docs/API.md` vs `services/api/src/routes/auth.ts` (lines 530, 575)                                                                         | `services/api/src/routes/auth.ts` implements `GET /api/v1/auth/oauth/:provider/url` and `POST /api/v1/auth/oauth/callback` (added in PR #213), but neither OAuth endpoint is documented in `docs/API.md`.                                                                                                                                                                                                                                                            | **Medium** | Add comprehensive documentation for both OAuth endpoints (parameters, state token verification, PKCE flow, and RFC 7807 problem responses) to `docs/API.md`. |
| Database Schema        | `packages/database/prisma/schema.prisma` vs `docs/database/schema-v1.md` (§3.3, §3.5, §3.7, §3.11, §3.13, §3.15)                            | Several hot-query indexes defined in the schema specification are missing from `schema.prisma`: `Room` (`[status, expiresAt]`), `RoomInvite` (`[roomId]`), `MediaSession` (`[roomId, createdAt]`), `ChatMessage` (`[roomId, createdAt]`, `[userId]`), `RoomMember` (`[userId]`), and `AuditEvent` (`[actorUserId, createdAt]`, `[roomId, createdAt]`).                                                                                                               | **Medium** | Add the missing index declarations to `packages/database/prisma/schema.prisma` to maintain performance on high-volume queries.                               |
| Error Codes & Protocol | `services/api/src/routes/rooms.ts`, `services/api/src/routes/tickets.ts`, `services/api/src/server.ts`                                      | While auth routes utilize `AUTH_REST_ERROR_CODES`, the room routes, ticket routes, and global auth decorators use bare string literals (`ERR_UNAUTHORIZED`, `ERR_INVALID_PAYLOAD`, `ERR_ROOM_NOT_FOUND`, `ERR_FORBIDDEN`, `ERR_INVITE_NOT_FOUND`, `ERR_INVITE_EXPIRED`, `ERR_INVITE_MAX_USES`, `ERR_ROOM_LOCKED`, `ERR_ROOM_FULL`, `ERR_NOT_ROOM_MEMBER`, `ERR_CANNOT_KICK_SELF`).                                                                                   | **Medium** | Expand `services/api/src/utils/errors.ts` to define centralized constants for room and general REST error codes, eliminating raw string literals.            |
| Database Schema        | `packages/database/prisma/schema.prisma` vs `docs/database/schema-v1.md` (§3.3, §3.7, §3.11, §3.15)                                         | Minor property and type deviations between spec and implementation: `Room.roomCode` is `VARCHAR(8)` in Prisma vs `VARCHAR(16)` in spec; `MediaSession.mediaUrl` is `VARCHAR(1024)` vs `VARCHAR(2048)`; `MediaSession.sourceType` is used instead of `provider_name`; `ChatMessage` uses boolean flags (`isSystem`, `isDeleted`) instead of `status` string and `deleted_at`; `AuditEvent` stores IP and user agent in `details` JSONB rather than dedicated columns. | **Low**    | Update `docs/database/schema-v1.md` to document these intentional implementation refinements.                                                                |
| Documentation Accuracy | `docs/SECURITY.md`                                                                                                                          | `docs/SECURITY.md` reflects the initial M1 baseline (dated 17 August 2026) and lacks architectural details on OAuth 2.0 PKCE / encrypted state tokens (PR #213) and security audit log telemetry (PR #219).                                                                                                                                                                                                                                                          | **Low**    | Update `docs/SECURITY.md` to incorporate OAuth cryptographic guarantees and audit trail mechanics.                                                           |
| Documentation Accuracy | `docs/TESTING.md` (§3)                                                                                                                      | `docs/TESTING.md` §3 lists `@huddly/api` status as "106+ tests passing", whereas the current test suite contains 198 passing tests across 16 test files.                                                                                                                                                                                                                                                                                                             | **Low**    | Update test count metrics in `docs/TESTING.md` to reflect current coverage (198 tests).                                                                      |
| Root Configuration     | `package.json` (line 41)                                                                                                                    | Root `package.json` contains `"license": "Apache-2.0"`. While ADR-013 originally selected Apache 2.0, subsequent repository cleanups (PR #101 through #104) established a personal-project, closed-development model (`"private": true`).                                                                                                                                                                                                                            | **Low**    | Align root `package.json` license property with personal project posture (e.g., `"UNLICENSED"` or retain private designation).                               |

---

## 3. Verified Clean

The following components, specifications, and configurations were inspected and verified correct:

- **M0 Specification Traceability:**
  - All Architectural Decision Records referenced in `docs/audit/spec-audit.md` (`ADR-001` through `ADR-013`) exist in `docs/adr/` with accepted status.
  - All file paths cited in `docs/security/threat-model.md` (`docs/protocol/v1.md`, `packages/protocol/src/schemas.ts`, `docs/SECURITY.md`, `docs/adr/ADR-010-extension-architecture.md`) exist and match current implementations.
  - `docs/research/competitive-analysis.md` explicitly excludes billing, multi-tenancy, and streaming proxies; a full codebase audit confirms zero billing or subscription code exists.
  - `docs/architecture/performance-observability.md` defines target metrics (`huddly_sync_drift_ms`, etc.) appropriately marked as specifications for future phases.
  - `docs/design/wireframes.md` layout names (Theater, Grid, Speaker Focus) remain consistent with `ROADMAP.md` Phase 9 planning.

- **API & Authentication Security Invariants:**
  - Argon2id password hashing parameters in `services/api/src/utils/security.ts` exactly match `docs/SECURITY.md` (64 MiB memory, 3 iterations, 4 parallelism threads).
  - Timing attack mitigation via constant-time `dummyVerify()` is present on non-existent login lookups.
  - Email canonicalization (`trim().toLowerCase()`) is enforced on user registration and lookup.
  - JWT access tokens enforce a strict 15-minute expiration (`expiresIn: '15m'`).
  - Refresh tokens are 256-bit CSPRNG hex strings stored as SHA-256 hashes in `user_devices` with automatic rotation and 7-day expiration.
  - Realtime connection tickets are single-use UUIDs stored in Redis with 60-second TTL and consumed atomically via `GETDEL`.

- **Database Model Integrity:**
  - `packages/database/src/index.ts` exports `prisma` singleton and Prisma types cleanly.
  - Models added during M1 and M2 (`RoomPermission`, `NavigationState`, `ModerationAction`, `AuditEvent`, `RoomInvite`) have valid relational foreign keys, cascading rules, and timestamps.

- **Test Suite Health & Assertions:**
  - `pnpm test` executes and passes across all packages and services.
  - `pnpm typecheck` (`tsc -b`) succeeds across all 8 referenced workspace projects.
  - `pnpm lint` and `prettier --check .` succeed with zero warnings or errors.
  - `pnpm --filter @huddly/e2e test` runs Playwright multi-client dual-browser synchronization tests and passes in Chromium and Firefox.
  - `auth.audit.test.ts` explicitly asserts against inserted audit rows, event types, and metadata payloads.
  - Mock Prisma instances across test files (`auth.audit.test.ts`, `auth.oauth.test.ts`, `api.test.ts`, `rooms.test.ts`, `tickets.test.ts`) share consistent typing and mock structures without masking schema validation bugs.

- **Issue & Milestone Board Hygiene:**
  - M0 Architecture milestone: 15/15 closed, verified against corresponding design docs and ADRs.
  - M1 Foundation milestone: 25/25 closed, verified against merged PRs and commit history.
  - M2 Rooms milestone: 5/12 closed (ROOM-001 through ROOM-004, plus duplicate issue #198 closed in favor of #195).
  - No stray commit message references (`Closes #NNN`) have inadvertently closed uncompleted M2 or M3 issues.

- **CI Workflows & Git Hooks:**
  - `.github/workflows/ci.yml` `ci-passed` gate accurately requires all 6 check jobs: `docs`, `lint`, `typecheck`, `test`, `build`, and `e2e`.
  - The AI attribution check regex in `.commit-msg-ai-check.sh` and the CI job in `.github/workflows/pr-validation.yml` are identical (`(claude|copilot|cursor|anthropic|openai|gemini|antigravity|codeium|devin)`).
  - All repository automation scripts (`.github/scripts/board-sync.sh`, `board-sweep.sh`, `board-lib.sh`) exist and have executable permissions.

- **Monorepo Configuration:**
  - `pnpm-workspace.yaml` correctly resolves `apps/*`, `packages/*`, and `services/*`, including `apps/e2e`.
  - Root `tsconfig.json` correctly references all 8 monorepo packages and apps (`packages/protocol`, `packages/config`, `packages/database`, `packages/sync-engine`, `packages/ui`, `services/api`, `services/realtime`, `apps/e2e`).
