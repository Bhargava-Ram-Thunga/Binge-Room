# BingeRoom — Master Session Prompt
# Auto-read by Claude Code at the start of every session.
# Replace only the SESSION TASK section each time.

/plan
planning-with-files

---

## BOOT SEQUENCE — MANDATORY EVERY SESSION

Execute in this exact order before touching anything:

1. Read this entire file top to bottom
2. Run: find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.turbo/*'
3. Run: git branch --show-current
4. Run: git log --oneline -5
5. Run: pnpm turbo test 2>&1 | tail -20
6. Output this block before any work begins:

```
═══ SESSION BOOT ════════════════════════════════
Branch     : [current branch]
Last commit: [last commit message]
Tests      : [N passed / N failed]
Dirty files: [git status --short]
═════════════════════════════════════════════════
```

If any test is already failing at boot — fix it before writing a single line of new code. A broken baseline means you cannot tell if your changes caused new failures.

---

## PROJECT IDENTITY

BingeRoom is a Chrome extension for synchronized YouTube watch parties.
Everyone in a room sees the same video playing, pausing, and seeking in perfect sync.
Phase 1: YouTube only. Auth: email/password and Google OAuth. No guests.

Repository : https://github.com/Bhargava-Ram-Thunga/Binge-Room
Owner      : Bhargava-Ram-Thunga (Bhargav) — extension, web, overlay UI
Collaborator: Dinesh-Reddy-Siramgari (Dinesh) — backend, WS server, sync engine, DB

## Package map

| Package | Name | Purpose | Port |
|---------|------|---------|------|
| packages/shared | @bingeroom/shared | Types, events, utils — zero runtime deps | — |
| packages/backend | @bingeroom/backend | Fastify REST + uWebSockets.js WS | 4000 / 4001 |
| packages/web | @bingeroom/web | Next.js 14 — landing, room, join pages | 3000 |
| packages/extension | @bingeroom/extension | Chrome MV3 — popup, content script, overlay | — |

## Branch model

| Branch | Purpose | Rule |
|--------|---------|------|
| prod | Production | 2 approvals, signed commits, linear history, all CI |
| dev | Integration | 1 approval, no force push, Test + Type check CI |
| feat/* | Feature work | No force push only |
| fix/* | Bug fixes | No force push only |
| hotfix/* | Prod emergency fixes | No force push, no deletion |

Never push directly to prod or dev. Always work on feat/* or fix/*.

---

## 10 ABSOLUTE RULES — NEVER VIOLATE

1. HEADERS BEFORE AWAIT
   In uWebSockets.js upgrade handler: read ALL req.getHeader() calls
   before any await. The request object is destroyed after the first await.
   Silent crash. Zero exceptions.

2. SINGLE ENV FILE
   One .env at monorepo root. Never create .env inside any package.
   Backend reads via src/env.ts (zod validated).
   Extension reads via Vite define() at build time (VITE_ prefix).
   Web reads via Next.js (NEXT_PUBLIC_ prefix).
   Never access process.env directly — always through src/env.ts.

3. REDIS TLS
   REDIS_URL must start with rediss:// not redis://.
   Upstash silently rejects non-TLS. Will appear connected then fail.

4. HOST AUTHORITY
   Server silently drops PLAY/PAUSE/SEEK from any userId that is not
   the current room hostId. Dropped — not errored. No response sent.

5. NO PLAYBACK CONTROLS IN OVERLAY
   The overlay contains: chat, presence, reactions, call.
   Never add play, pause, seek, or progress bar. Not even disabled.
   The native YouTube player IS the sync mechanism.

6. SHARED TYPES ONLY
   Never redefine a type that exists in @bingeroom/shared.
   Add it to shared first, then import it everywhere.
   Any PR touching packages/shared requires both Bhargav and Dinesh to review.

7. ZOD EVERYTHING
   Every WS message payload, REST request body, and env var is validated
   with zod before any logic runs. Never trust raw input.

8. NO ANY TYPE
   TypeScript any is never used. Use unknown and narrow it.
   tsc --strict must pass with zero errors.

9. NO CONSOLE.LOG IN PRODUCTION CODE
   Use pino logger in backend. Nothing in extension/web non-test code.
   console.log is allowed only inside *.test.ts files.

10. COMMIT PER TASK
    Every completed task is its own commit pushed immediately.
    Never batch commits at end of session.
    Never commit with failing tests.

---

## SKILL ACTIVATION — FIRES AUTOMATICALLY

Every skill below fires based on what you are doing.
You do not wait to be told — you fire the skill when the trigger condition is met.

### planning-with-files
TRIGGER: First thing in every session after boot sequence.
DO: Load full project context into working memory. Read SCHEMA.md,
    WS_EVENTS.md if they exist. Map what exists vs what needs building.
NEVER skip this — open source models lose context mid-session without it.

### /brainstorm
TRIGGER: Before designing any non-trivial piece of logic.
USE FOR: Sync algorithm edge cases, auth flow scenarios, WS handler
         failure modes, any feature with more than 3 moving parts.
OUTPUT: Exhaustive list of scenarios including happy path, edge cases,
        error cases, race conditions, and failure modes.

### /write-plan
TRIGGER: After /brainstorm produces scenarios.
DO: Convert brainstorm output into an ordered task list with
    explicit definition-of-done per task.
OUTPUT: Numbered plan confirmed before any implementation starts.

### /execute-plan
TRIGGER: After /write-plan is confirmed.
DO: Execute the plan task by task. After each task: test → lint → commit → push.
Never jump ahead. Never skip a task. Never combine two tasks into one commit.

### test-driven-development
TRIGGER: Before implementing ANY of these:
  - Any function in packages/shared/src/utils/
  - Any WS handler in packages/backend/src/ws/handlers/
  - Any REST route in packages/backend/src/rest/routes/
  - Any middleware in packages/backend/src/rest/middleware/
  - packages/backend/src/ws/syncEngine.ts
  - packages/backend/src/env.ts
  - packages/extension/src/content/ytPlayer.ts
  - Any auth or token logic

STRICT RED-GREEN-REFACTOR PROCESS:
  RED   : Write test. Run it. Confirm it fails for the right reason.
          "Cannot find module" = wrong. "Expected X received undefined" = wrong.
          "Expected 105 received 100" = correct — implementation is missing.
  GREEN : Write minimum implementation to make test pass.
  REFACTOR: Run /simplify. Re-run tests. Confirm still green.
  COMMIT: Only after all three phases complete for this task.

### /simplify
TRIGGER AUTOMATICALLY when:
  - Any file exceeds 80 lines after implementation
  - Any function exceeds 20 lines
  - Any callback nesting exceeds 2 levels
  - A file has been modified more than 3 times in one session
DO: Apply suggestions. Re-run tests. Confirm green.

### /debug
TRIGGER: Any unexpected test failure, build error, or runtime crash.
DO: Pass the FULL error with complete stack trace — never summarize.
LIMIT: If not resolved after 2 attempts — output ⚠ BLOCKED and stop.
Never retry the same fix twice.

### /batch
TRIGGER: Creating 3 or more structurally similar files.
USE FOR: ws/handlers/*.ts, rest/routes/*.ts, __tests__/*.test.ts,
         overlay components in one pass.
OUTPUT: All files generated with identical structure and naming convention.

### frontend-design
TRIGGER: Before building ANY UI component — one trigger per component.
DO: Apply exact design tokens from packages/extension/src/lib/tokens.ts
    and packages/web/lib/tokens.ts.
RULE: Every hex value comes from tokens.ts. No hardcoded colors in components.
RULE: Every border-radius, transition, shadow comes from tokens.ts.
RULE: Ladle story written before component implementation (test-driven for UI).

### graphify
TRIGGER: When creating architecture diagrams, flow diagrams, or
         data relationship visualizations for documentation.
USE FOR: docs/ directory diagrams, README architecture diagram,
         WS event flow visualization, auth flow diagram.
OUTPUT: Embed as mermaid in markdown files so GitHub renders them.

### web-app-security
TRIGGER: After implementing any of:
  - Auth endpoints or middleware
  - Token generation or validation
  - Invite link creation or resolution
  - Any user input that reaches DB or WS server
  - CORS configuration

CHECKS: SQL injection paths, JWT tampering, missing expiry,
        secret exposure in client bundles, unvalidated input,
        CORS misconfiguration, missing rate limits.
FIX: All CRITICAL and HIGH findings before committing.

### api-security-testing
TRIGGER: After implementing any REST route.
GENERATE AND RUN these attack cases for every route:
  - No Authorization header → must return 401
  - Expired token → must return 401
  - Token with one character flipped → must return 401
  - Wrong Content-Type → must return 415
  - Payload 10x over expected size → must return 413
  - Request that hits rate limit → must return 429
  - SQL injection in string fields → must return 400, never 500
  - XSS payload in string fields → must return 400, never 500
All attack cases committed as real test files — not just manual checks.

### shannon
TRIGGER: End of any session that touched auth, tokens, invite flow,
         or any security-sensitive code path.
NOT triggered: scaffold sessions, config-only sessions, type-only changes.
OUTPUT: Shannon report. Fix all findings before session ends.

### web-quality-audit
TRIGGER: After completing web app pages or overlay components.
CHECK: Performance, accessibility, best practices on the UI layer.

### performance
TRIGGER: After overlay bundle is built.
CHECK: Bundle size must stay under 200kb for overlay.
       Content script must not increase YouTube LCP.
       Sync event round-trip target under 200ms on same network.

### accessibility
TRIGGER: After every UI component is visually complete.
CHECK: aria-labels on interactive elements, WCAG AA contrast on #080810
       background, keyboard navigation, focus rings visible (cyan glow counts),
       screen reader announces connected/disconnected state changes.

### best-practices
TRIGGER: After completing a full feature (not individual functions).
A feature = implementation + tests green + security checked + pushed.
RUN on the feature's entire directory.

### /simplify (second pass)
TRIGGER: After best-practices pass on any file.
DO: Final clean-up pass. Re-run tests after.

### core-web-vitals
TRIGGER: After web app pages are built.
CHECK: LCP under 2.5s on join page and landing page.

### /plan:status
TRIGGER:
  - After every numbered task in the session task list
  - Every 30 minutes during a long session
  - Before any commit to verify correct branch
OUTPUT: Tasks completed, tasks remaining, current branch, any drift from plan.

---

## TESTING STANDARDS — NON-NEGOTIABLE

### What rigorous means

COSMETIC (worthless — proves nothing):
```typescript
it('computeHostPosition works', () => {
  const result = computeHostPosition(100, Date.now(), true)
  expect(result).toBeDefined()  // passes even if function returns undefined
})
```

RIGOROUS (valuable — proves the algorithm):
```typescript
it('adds elapsed seconds to position when playing — 5s elapsed gives ~105', () => {
  const lastPosition = 100
  const lastTimestamp = Date.now() - 5000
  const result = computeHostPosition(lastPosition, lastTimestamp, true)
  expect(result).toBeGreaterThan(104.9)
  expect(result).toBeLessThan(105.1)
  // Fails if function ignores elapsed time. Exact, meaningful failure.
})
```

### Test file structure — follow exactly

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CONSTANT } from '@bingeroom/shared'

describe('ModuleName', () => {
  describe('FunctionName', () => {
    describe('happy path', () => {
      it('returns X when given valid Y', () => { ... })
    })
    describe('edge cases', () => {
      it('returns X when Y is at exact boundary value', () => { ... })
      it('returns X when Y is empty', () => { ... })
    })
    describe('error cases', () => {
      it('throws SPECIFIC_ERROR when Y is null', () => { ... })
      it('returns 401 with code INVALID_TOKEN when JWT is tampered', () => { ... })
    })
  })
})
```

### Minimum test counts per file

| File | Min tests | Why |
|------|-----------|-----|
| utils/time.ts | 13 | Core sync math — wrong here = desync for all users |
| utils/room.ts | 6 | Token uniqueness is a security property |
| env.ts | 12 | Every missing key must fail with exact field name |
| auth middleware | 12 | Every bypass is a breach |
| syncEngine.ts | 15 | Most complex logic, most failure modes |
| ws/handlers/play.ts | 8 | |
| ws/handlers/pause.ts | 8 | |
| ws/handlers/seek.ts | 10 | Feedback loop guard needs thorough testing |
| ws/handlers/chat.ts | 8 | |
| ws/handlers/reaction.ts | 6 | |
| ws/handlers/videoChange.ts | 8 | |
| ws/handlers/roomClose.ts | 8 | |
| invite token flow | 10 | Security-critical path |
| ytPlayer.ts | 10 | Feedback loop guard + SPA navigation |
| REST routes | 8 each | Includes all attack cases from api-security-testing |

### Test naming convention — full sentences

```typescript
it('returns the host position plus elapsed seconds when isPlaying is true')
it('returns exact lastPosition when isPlaying is false regardless of elapsed time')
it('silently drops SEEK event when sender is not the room host')
it('redirects all guests to /ended when ROOM_CLOSE is broadcast')
it('returns 401 with code INVALID_TOKEN when Authorization header is missing')
it('does not re-emit seeked event when isApplyingRemote flag is true')
```

### Test file location

```
packages/shared/src/utils/__tests__/time.test.ts
packages/shared/src/utils/__tests__/room.test.ts
packages/backend/src/__tests__/env.test.ts
packages/backend/src/__tests__/auth.test.ts
packages/backend/src/ws/__tests__/syncEngine.test.ts
packages/backend/src/ws/handlers/__tests__/play.test.ts
packages/extension/src/content/__tests__/ytPlayer.test.ts
```

---

## GIT WORKFLOW — EXACT STEPS AFTER EVERY TASK

After EACH completed task — not at session end. After EACH task.

```bash
# 1. Verify branch
git branch --show-current
# If wrong branch: STOP. Switch. Do not commit on wrong branch.

# 2. Run tests for affected package only
pnpm --filter @bingeroom/[package] test
# If any failure: fix it. No exceptions. No partial commits.

# 3. Run lint
pnpm --filter @bingeroom/[package] lint
# Fix all errors. Warnings acceptable.

# 4. Stage ONLY files for this task
git add [explicit file list]
# Never git add .
# Run git status to confirm only intended files are staged

# 5. Commit
git commit -m "type(scope): description"

# 6. Push
git push origin [current-branch]

# 7. Output report
```

After every push output exactly:

```
═══ TASK COMPLETE ═══════════════════════════════
✓ COMMITTED : [full commit message]
✓ BRANCH    : [branch name]
✓ TESTS     : [N passed, 0 failed]
✓ STAGED    : [files committed]
✓ SKILLS    : [which skills fired this task]
→ NEXT      : [next task name]
═════════════════════════════════════════════════
```

### Commit message format

```
type(scope): description
```

Types: feat, fix, test, refactor, chore, security, perf, docs
Scopes: shared, backend, ws, rest, auth, db, redis, sync, ext, content, overlay, web, env

Examples:
```
feat(shared): add WsEvent discriminated union with 11 event types
test(shared): add 13 rigorous time utility tests — RED phase
feat(ws): add upgrade handler with pre-await header reads
fix(ws): guard ytPlayer feedback loop with isApplyingRemote flag
test(auth): add 12 attack cases for JWT middleware
security(auth): validate invite token signature before room join
feat(overlay): add ChatPanel component with auto-scroll and typing indicator
```

---

## DESIGN TOKENS — USE THESE, NEVER HARDCODE

All tokens live in packages/extension/src/lib/tokens.ts
and packages/web/lib/tokens.ts (identical content).

```typescript
export const colors = {
  black: '#080810',        // ALL backgrounds — never use pure #000
  navy: '#0E0E1C',         // cards, inputs, secondary surfaces
  violet: '#7C6FFF',       // brand, CTAs, active states
  cyan: '#00E5FF',         // hover, connected indicator, focus rings
  textPrimary: '#EEEEF5',  // all important text — never pure white
  textSecondary: '#7878A0', // timestamps, labels, metadata
  pink: '#FF3C6E',         // errors, destructive, YouTube brand icon
  green: '#00E5AA',        // online dots, connected, positive states
  amber: '#FFB800',        // reconnecting, sync issues, warnings
  glass: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
} as const

export const radii = {
  sm: '6px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '9999px',
} as const

export const transitions = {
  fast: '150ms ease',
  normal: '250ms ease',
  slow: '400ms ease',
} as const

export const shadows = {
  violet: '0 0 40px rgba(124, 111, 255, 0.25)',
  cyan: '0 0 30px rgba(0, 229, 255, 0.15)',
  card: '0 8px 32px rgba(0, 0, 0, 0.6)',
} as const
```

---

## WEBSOCKET EVENTS REFERENCE

All 11 event types — defined in packages/shared/src/events.ts.
Full spec in docs/WS_EVENTS.md.

| Event | Direction | Who sends | Host only? |
|-------|-----------|-----------|------------|
| ROOM_STATE | server→client | server | — |
| PLAY | client→server→clients | host only | YES |
| PAUSE | client→server→clients | host only | YES |
| SEEK | client→server→clients | host only | YES |
| CHAT_MSG | client→server→clients | any member | NO |
| MEMBER_JOIN | server→clients | server | — |
| MEMBER_LEAVE | server→clients | server | — |
| HOST_SWITCH | client→server→clients | current host | YES |
| VIDEO_CHANGE | client→server→clients | host only | YES |
| REACTION | client→server→clients | any member | NO |
| ROOM_CLOSE | client→server→clients | host only | YES |

---

## BLOCKED PROTOCOL

When genuinely unsure — do not guess. Output this and stop:

```
⚠ BLOCKED ════════════════════════════════════════
ISSUE    : [one sentence — exactly what is unclear]
OPTIONS  :
  A) [approach] — [tradeoff]
  B) [approach] — [tradeoff]
  C) [approach] — [tradeoff]
RECOMMEND: [A/B/C] because [one sentence]
WAITING  : your confirmation before writing any code
══════════════════════════════════════════════════
```

Do not proceed past a BLOCKED output until explicit confirmation.

---

## END OF SESSION PROTOCOL

Before declaring session complete, verify every item:

```
═══ SESSION END CHECKLIST ═══════════════════════
□ Every task committed individually (not batched)
□ pnpm turbo test — 0 failures across all packages
□ pnpm turbo build — 0 errors
□ No .env created inside any package directory
□ grep -r "process\.env" packages/*/src — returns nothing
□ No `any` type (tsc --strict confirms)
□ No types redefined locally that exist in @bingeroom/shared
□ No console.log in non-test files
□ Branch pushed to origin
□ /plan:status run and output shown
□ shannon run if auth/tokens touched this session
□ best-practices run on completed features
□ web-app-security run if any endpoint added
═════════════════════════════════════════════════
```

Output each with ✓ or ✗.
If any ✗ — fix it. Session is not complete until all ✓.

Then output:

```
═══ DINESH HANDOFF NOTE ═════════════════════════
Completed today  : [list of completed tasks]
Shared/ changes  : [any changes to @bingeroom/shared — he MUST know]
New env keys     : [any new keys added to .env.example]
New DB migrations: [any new prisma migrations]
His first task   : [exact task to start tomorrow]
Blockers for him : [anything that will block his work]
═════════════════════════════════════════════════
```

---

## CURRENT PROJECT STATE

Repo        : https://github.com/Bhargava-Ram-Thunga/Binge-Room
Active branch: feat/monorepo-setup
Completed   : GitHub setup (branches, rulesets, labels, milestones, 19 issues, board)
On board    : M1-M4 → Building, M5-M19 → Backlog
Next        : M1 — Monorepo foundation

Board columns: Backlog → Building → Review → Shipped

Services ready:
  Supabase — project created (fill SUPABASE_* in .env)
  Upstash Redis — created (fill REDIS_URL in .env)
  Daily.co — needs account creation (fill DAILY_* in .env)
  OpenRouter — Claude Code model configured in settings.json

---

## SESSION TASK — REPLACE THIS SECTION EVERY SESSION

Branch   : feat/[branch-name]
Task     : M[number] — [milestone name]
Packages : [which packages are touched]
Done when: [exact definition of done]

/plan:status
