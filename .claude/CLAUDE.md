# BingeRoom — Master Session Prompt
# Works for both Claude Pro (via subscription) and Gemma 4 (via Ollama fallback)
# Auto-read by Claude Code at start of every session
# Replace only the SESSION TASK section each time

---

## MODEL DETECTION — READ THIS FIRST

If you are Claude (Sonnet/Opus via Pro subscription):
- You hold full context across long sessions
- Follow instructions as written
- Pause before git push as specified

If you are Gemma 4 (via Ollama claude --model gemma4:31b-cloud):
- Re-read this entire file every 30 minutes during long sessions
- Run /plan:status after every single task, not just every 30 minutes
- Before writing any code, output your ultrathink analysis (see below)
- You are more likely to drift — the plan:status check is your anchor
- All other rules are identical

---

## BOOT SEQUENCE — MANDATORY EVERY SESSION

Execute in this exact order. No permission needed for any of these.
Run all commands immediately without asking:

```bash
find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' \
  -not -path '*/dist/*' -not -path '*/.turbo/*' | head -60
git branch --show-current
git log --oneline -5
git status --short
pnpm turbo test 2>&1 | tail -20
```

Output this before any work:

```
═══ SESSION BOOT ════════════════════════════════
Model      : [Claude Sonnet / Gemma 4 — which are you]
Branch     : [current branch]
Last commit: [last commit message]
Tests      : [N passed / N failed]
Dirty files: [git status --short]
Milestone  : [which milestone this session works on]
Board state: [current status of this milestone on project board]
═════════════════════════════════════════════════
```

If any test is failing at boot — fix it before anything else.

---

## ULTRATHINK — FIRES BEFORE EVERY CODE BLOCK

Before writing any implementation, output this analysis silently
then proceed. Do not ask permission to do this — just do it:

```
ULTRATHINK ══════════════════════════════════════
Security   : How would shannon break what I am about to write?
             Is there an injection path? An exposed secret?
             A missing auth check? An unvalidated input?
Types      : Does @bingeroom/shared already have this type?
             If yes — import it, never redefine it.
             If no — add it to shared first, then import.
Performance: Will this bloat the extension content script?
             Is this on the critical sync path?
             Should this DB write be async (fire and forget)?
Test first : What is the minimum test that would fail if this
             implementation is wrong? Write that test first.
Plan check : Does this match the session task? Am I drifting?
══════════════════════════════════════════════════
```

This takes 10 seconds and prevents 10 hours of debugging.

---

## AUTONOMOUS EXECUTION PROTOCOL

Run these immediately without asking for permission:
- All file reads: cat, find, ls, grep, head, tail
- All test runs: pnpm test, pnpm turbo test
- All build checks: pnpm build, pnpm turbo build
- All lint runs: pnpm lint
- All internal skill triggers: /brainstorm, /simplify, shannon, web-quality-audit
- All git operations EXCEPT push: git add, git commit, git status, git log
- Installing packages: pnpm add
- Running scripts: pnpm turbo [anything]

PAUSE and wait for explicit confirmation before:
- git push — always confirm branch and content before pushing
- Any command requiring sudo
- Any command that modifies external services (Daily.co, Supabase, Upstash)
- Opening a PR (gh pr create)
- Any database migration (prisma migrate)

This is the only permission boundary. Everything else: just do it.

---

## SKILL CHAIN — FIRES AUTOMATICALLY

### At session start
1. planning-with-files — load full project context immediately
2. /plan:status — confirm current milestone and tasks

### Before writing any code
3. ultrathink analysis (see above) — no permission needed
4. /brainstorm — list all scenarios: happy path, edge cases, errors, race conditions

### During implementation
5. test-driven-development — tests written before implementation, always
6. /simplify — fires automatically when any file exceeds 80 lines
7. /debug — fires on any unexpected failure, 2 attempts max then ⚠ BLOCKED

### After each task completes
8. /plan:status — confirm progress, confirm still on correct branch

### After completing a full feature
9. shannon — autonomous security scan, no permission needed, runs immediately
10. web-quality-audit — runs on packages/web and packages/extension
11. best-practices — runs on the feature directory
12. accessibility — runs on any UI component
13. performance — runs on extension build, target under 200kb overlay bundle

### When creating multiple similar files
14. /batch — generates all files in one pass with consistent structure

### When creating docs or architecture diagrams
15. graphify — generates mermaid diagrams embedded in markdown

### Before declaring any milestone done
16. shannon — MANDATORY final security scan
17. web-quality-audit — MANDATORY final quality check
18. ultrathink — one final pass: "what did I miss?"

---

## PROJECT IDENTITY

BingeRoom is a Chrome extension for synchronized YouTube watch parties.
Phase 1: YouTube only. Auth: email/password + Google OAuth. No guest mode.

Repository   : https://github.com/Bhargava-Ram-Thunga/Binge-Room
Team         : Bhargava-Ram-Thunga + Dinesh-Reddy-Siramgari
Both work on all parts — no strict ownership by person

## Package map

| Package | Name | Port |
|---------|------|------|
| packages/shared | @bingeroom/shared | — |
| packages/backend | @bingeroom/backend | 4000 REST / 4001 WS |
| packages/web | @bingeroom/web | 3000 |
| packages/extension | @bingeroom/extension | — |

## Environment

Primary dev   : GitHub Codespaces (both team members)
Extension test: Local Mac only (no Chrome in Codespaces)
Model primary : Claude Pro via subscription (claude login)
Model fallback: Gemma 4 via Ollama (claude --model gemma4:31b-cloud)
Sync          : git push/pull through GitHub — never manual file copies

## Branch model

| Branch | Purpose | Ruleset |
|--------|---------|---------|
| prod | Production | 2 approvals, signed commits, linear history, all CI |
| dev | Integration | 1 approval, no force push, Test + Type check CI |
| feat/* | Feature work | No force push only |
| fix/* | Bug fixes | No force push only |
| hotfix/* | Prod emergency | No force push, no deletion |

---

## MILESTONE TRACKER — UPDATE THIS TABLE EVERY SESSION

| # | Milestone | Status | Branch |
|---|-----------|--------|--------|
| M0 | GitHub setup — branches, rulesets, board, CI | Shipped | — |
| M1 | Monorepo foundation | Building | feat/monorepo-setup |
| M2 | Shared types package | Backlog | feat/shared-types |
| M3 | Database schema + Prisma | Backlog | feat/database-schema |
| M4 | Backend env + server boot | Backlog | feat/backend-scaffold |
| M5 | Auth — Supabase OAuth + email/password | Backlog | feat/supabase-auth |
| M6 | Room create + invite link + 6-digit code | Backlog | feat/room-create |
| M7 | WebSocket server | Backlog | feat/ws-server |
| M8 | Sync engine | Backlog | feat/sync-engine |
| M9 | All WS event handlers | Backlog | feat/ws-handlers |
| M10 | Extension scaffold + background worker | Backlog | feat/extension-scaffold |
| M11 | YouTube content script | Backlog | feat/yt-content-script |
| M12 | Overlay mount + store | Backlog | feat/overlay-ui |
| M13 | Overlay UI components | Backlog | feat/overlay-components |
| M14 | Video + audio call (Daily.co) | Backlog | feat/video-audio-call |
| M15 | Web app pages | Backlog | feat/web-pages |
| M16 | End-to-end integration testing | Backlog | feat/integration-tests |
| M17 | Security audit | Backlog | feat/security-audit |
| M18 | Performance pass | Backlog | feat/performance |
| M19 | Alpha deploy + 10 real users | Backlog | feat/alpha-deploy |

When milestone status changes:
1. Update the table above
2. Move the GitHub issue on the project board via gh CLI:

```bash
gh project list --owner Bhargava-Ram-Thunga
gh project item-edit \
  --project-id PROJECT_ID \
  --id ITEM_ID \
  --field-id STATUS_FIELD_ID \
  --single-select-option-id OPTION_ID
```

Board columns: Backlog → Building → Review → Shipped
Move to Review when PR is opened.
Move to Shipped when PR is merged to dev.

---

## 10 ABSOLUTE RULES — NEVER VIOLATE

1. HEADERS BEFORE AWAIT
   uWebSockets.js upgrade handler: ALL req.getHeader() calls before
   any await. Request dies after first await. Silent crash.

2. SINGLE ENV FILE
   One .env at root. Never create .env inside packages.
   Backend → src/env.ts. Extension → Vite define(). Web → NEXT_PUBLIC_.
   Never access process.env directly.

3. REDIS TLS
   REDIS_URL must start with rediss:// not redis://.

4. HOST AUTHORITY
   Server silently drops PLAY/PAUSE/SEEK from non-host userId.
   Dropped, not errored. No response sent.

5. NO PLAYBACK CONTROLS IN OVERLAY
   Chat, presence, reactions, call only.
   Never add play/pause/seek/progress. Not even disabled.

6. SHARED TYPES ONLY
   Never redefine types from @bingeroom/shared locally.
   Add to shared first, import everywhere.

7. ZOD EVERYTHING
   Every WS payload, REST body, env var validated with zod.

8. NO ANY TYPE
   Use unknown and narrow it. tsc --strict must pass.

9. NO CONSOLE.LOG IN PRODUCTION CODE
   Pino in backend. Nothing in extension/web non-test files.

10. COMMIT PER TASK
    Every task = one commit pushed immediately.
    Never batch. Never commit red tests.

---

## TESTING STANDARDS

### Red-Green-Refactor — strictly in order

RED:    Write test. Run it. It must fail for the RIGHT reason.
        "Cannot find module" = setup error, fix setup.
        "Expected 105 received 100" = correct, implementation missing.
        Never proceed to GREEN if the failure reason is wrong.

GREEN:  Write minimum implementation. Tests pass.

REFACTOR: Run /simplify. Re-run tests. Confirm still green.

COMMIT: Only after all three phases complete for this task.

### Minimum test counts

| File | Min |
|------|-----|
| utils/time.ts | 13 |
| utils/room.ts | 6 |
| env.ts | 12 |
| auth middleware | 12 |
| syncEngine.ts | 15 |
| each ws handler | 8 |
| ws/handlers/seek.ts | 10 |
| invite token | 10 |
| ytPlayer.ts | 10 |
| each REST route | 8 |

### Test naming — full sentences

```typescript
it('adds elapsed seconds to position when isPlaying is true')
it('returns exact lastPosition when paused regardless of elapsed time')
it('silently drops SEEK from non-host without sending error response')
it('returns 401 with code INVALID_TOKEN when Authorization header missing')
```

---

## GIT WORKFLOW — AFTER EVERY TASK

```bash
# 1. Verify branch — stop if wrong
git branch --show-current

# 2. Tests
pnpm --filter @bingeroom/[package] test
# Zero failures required — no exceptions

# 3. Lint
pnpm --filter @bingeroom/[package] lint

# 4. Stage explicitly — never git add .
git add [specific files only]
git status  # confirm nothing extra staged

# 5. Commit
git commit -m "type(scope): description"

# 6. PAUSE — output what is about to be pushed, wait for confirmation
# "About to push [commit] to [branch]. Confirm? (yes/no)"

# 7. After confirmation: push
git push origin [branch]

# 8. Update project board if milestone status changed

# 9. Output report
```

Report after every push:
```
═══ TASK COMPLETE ═══════════════════════════════
✓ COMMITTED : [commit message]
✓ BRANCH    : [branch]
✓ TESTS     : [N passed, 0 failed]
✓ STAGED    : [files]
✓ SKILLS    : [skills fired this task]
✓ BOARD     : [milestone moved / no change]
→ NEXT      : [next task]
═════════════════════════════════════════════════
```

### Commit types and scopes

Types: feat, fix, test, refactor, chore, security, perf, docs
Scopes: shared, backend, ws, rest, auth, db, redis, sync, ext, content, overlay, web, env, monorepo

---

## DESIGN TOKENS

packages/extension/src/lib/tokens.ts and packages/web/lib/tokens.ts

```typescript
export const colors = {
  black: '#080810',
  navy: '#0E0E1C',
  violet: '#7C6FFF',
  cyan: '#00E5FF',
  textPrimary: '#EEEEF5',
  textSecondary: '#7878A0',
  pink: '#FF3C6E',
  green: '#00E5AA',
  amber: '#FFB800',
  glass: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
} as const

export const radii = {
  sm: '6px', md: '12px', lg: '16px', xl: '20px', full: '9999px',
} as const

export const transitions = {
  fast: '150ms ease', normal: '250ms ease', slow: '400ms ease',
} as const

export const shadows = {
  violet: '0 0 40px rgba(124, 111, 255, 0.25)',
  cyan: '0 0 30px rgba(0, 229, 255, 0.15)',
  card: '0 8px 32px rgba(0, 0, 0, 0.6)',
} as const
```

---

## WEBSOCKET EVENTS

Full spec: docs/WS_EVENTS.md

| Event | Sender | Host only |
|-------|--------|-----------|
| ROOM_STATE | server | — |
| PLAY | host | YES |
| PAUSE | host | YES |
| SEEK | host | YES |
| CHAT_MSG | any member | NO |
| MEMBER_JOIN | server | — |
| MEMBER_LEAVE | server | — |
| HOST_SWITCH | current host | YES |
| VIDEO_CHANGE | host | YES |
| REACTION | any member | NO |
| ROOM_CLOSE | host | YES |

---

## DATABASE STATE

docs/SCHEMA.md — design document, exists ✓
prisma/schema.prisma — created in M3, does not exist yet
Supabase database — empty, tables created in M3

---

## BLOCKED PROTOCOL

```
⚠ BLOCKED ════════════════════════════════════════
ISSUE    : [one sentence — exactly what is unclear]
OPTIONS  :
  A) [approach] — [tradeoff]
  B) [approach] — [tradeoff]
RECOMMEND: [A/B] because [reason]
WAITING  : explicit confirmation before proceeding
══════════════════════════════════════════════════
```

---

## END OF SESSION CHECKLIST

```
═══ SESSION END ═════════════════════════════════
□ Every task committed individually
□ pnpm turbo test — 0 failures
□ pnpm turbo build — 0 errors
□ No .env inside any package
□ grep -r "process\.env" packages/*/src — nothing outside env.ts
□ No any type (tsc --strict passes)
□ No types redefined from @bingeroom/shared
□ No console.log in non-test files
□ Branch pushed to origin
□ Project board updated
□ Milestone tracker table updated above
□ shannon run if auth/tokens touched
□ web-quality-audit run if UI touched
□ /plan:status final output shown
═════════════════════════════════════════════════
```

Output each with ✓ or ✗. Fix all ✗ before declaring done.

Then output:

```
═══ HANDOFF NOTE ════════════════════════════════
Completed    : [list of tasks done]
Board moved  : [milestone from X to Y]
shared/ changes: [other person MUST know these]
New env keys : [added to .env.example]
New migrations: [prisma migrations run]
Next task    : [exact next thing]
Blockers     : [anything blocking next session]
═════════════════════════════════════════════════
```

---

## SESSION TASK — REPLACE THIS EVERY SESSION

Branch   : feat/[branch-name]
Task     : M[number] — [name]
Packages : [which packages]
Done when: [exact definition]

/plan:status