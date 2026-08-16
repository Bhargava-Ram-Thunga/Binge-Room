# Next Session — agent handoff

Living handoff for whichever agent/IDE picks up the work (Claude Code,
Antigravity, Cursor…). **Update the "Now" section at the end of every session.**

Last updated: 17 Aug 2026, after completing ARCH-009 (ADR-010..012), FOUND-013 (ARCHITECTURE.md), and personal project policy configuration.

---

## 1. What Huddly is

Huddly is an active **personal project** by @Bhargava-Ram-Thunga — a real-time watch-together platform. Everyone watches in **their own browser**; the server synchronizes **playback state, not pixels**. Browser extension + Node/TypeScript backend. Read [ROADMAP.md](../../ROADMAP.md) and [release-plan.md](release-plan.md) before starting.

## 2. Repo state (as of this handoff)

|                |                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Repo           | `Bhargava-Ram-Thunga/Huddly` (personal project, Apache-2.0)                                                    |
| Default branch | `dev`                                                                                                          |
| Branches       | `dev` → `main` → `prod` only. All three protected.                                                             |
| Stack          | pnpm workspaces + Turborepo + TypeScript strict + Vitest                                                       |
| Packages       | `@huddly/protocol`, `@huddly/sync-engine`, `@huddly/config`, `@huddly/database`, `@huddly/ui`                  |
| Services       | `services/api` (Fastify REST), `services/realtime` (Fastify WebSocket Gateway)                                 |
| Specs & Docs   | `ARCHITECTURE.md`, `docs/MVP.md`, `docs/protocol/v1.md`, `docs/database/schema-v1.md`, `docs/adr/ADR-010..013` |
| Board          | Project #3 "Huddly Roadmap" (4 columns: Backlog, In Progress, In Review, Done)                                 |
| Milestones     | M0…M12, due dates set. **M0 due 30 Aug 2026.**                                                                 |

## 3. Non-negotiable working rules

Branch protection **will** reject violations. Follow exactly:

1. **Never commit to `dev`, `main`, or `prod` directly.** Always a feature branch + PR.
2. **Branch name** must match:
   `^(feat|fix|docs|refactor|perf|test|build|ci|chore|hotfix)/[a-z0-9._-]+$`
   e.g. `docs/protocol-v1`, `feat/room-service`.
3. **PR title** must be conventional commits:
   `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(scope\))?!?: .+`
4. **PR base is `dev`.** Never open a PR straight to `main`/`prod`; the "Merge target" check enforces `feature → dev → main → prod`.
5. **Link the issue** with `Closes #NN` in the PR body — board automation depends on it.
6. Before pushing, these must pass locally:

   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   npx markdownlint-cli2          # any .md change
   npx prettier@3 --write <files> # fixes most lint failures
   ```

7. **Squash-merge** PRs into `dev`. Delete the branch after.
8. Never approve or trigger the **production** deployment — human-only gate.

Required checks on every PR: `CI passed`, `Secret scan (gitleaks)`,
`Conventional PR title`, `Branch naming`, `Merge target`.

## 4. The board runs itself

Do **not** drag cards. Automation (see [board-automation.md](board-automation.md))
moves them: PR opened → In Review, merged to `dev` → Done.

## 5. NOW — Current Progress & Next Steps

### Completed Milestones & Issues:

- [x] **ARCH-014 MVP scope freeze (#50)** $\to$ [`docs/MVP.md`](../MVP.md) merged.
- [x] **ARCH-010 Protocol v1 (#46)** $\to$ [`docs/protocol/v1.md`](../protocol/v1.md) + `@huddly/protocol` envelope/payload Zod validators merged.
- [x] **ARCH-011 Database schema v1 (#47)** $\to$ [`docs/database/schema-v1.md`](../database/schema-v1.md) with full ERD merged.
- [x] **ARCH-009 ADR-010..012 (#45)** $\to$ [ADR-010](../adr/ADR-010-extension-architecture.md), [ADR-011](../adr/ADR-011-sync-algorithm.md), [ADR-012](../adr/ADR-012-adapter-architecture.md) merged.
- [x] **FOUND-013 System Architecture Overview (#64)** $\to$ [`ARCHITECTURE.md`](../../ARCHITECTURE.md) merged.
- [x] **FOUND-014 Security & Code of Conduct (#65)** $\to$ `SECURITY.md`, `CODE_OF_CONDUCT.md` merged.
- [x] **FOUND-009 Docker Compose Dev Environment (#60)** $\to$ Root `docker-compose.yml` (Postgres 16 + Redis 7) merged.
- [x] **FOUND-010 Typed Environment Management (#61)** $\to$ `@huddly/config` with Zod validation merged.
- [x] **FOUND-001 Backend Service Initialization (#52)** $\to$ `services/api`, `services/realtime`, `@huddly/database` merged.

### Immediate Next Tasks (Backlog):

1. **`DESIGN-003` (#84)**: UI kit — design tokens and shared React 19 cinema components in `packages/ui` (`Button`, `Badge`, `GlassCard`, `InviteModal`, `ChatDrawer`, `VideoControls`, `ParticipantAvatar`, `ThemeToggle`).
2. **`FOUND-008` (#59)**: Playwright E2E harness (multi-context two-client foundation).
3. **`ARCH-007` (#43)**: ADR-004..006 — PostgreSQL, Redis boundaries, WebSockets.
4. **`ARCH-006` (#42)**: ADR-001..003 — WebRTC, SFU topology, LiveKit vs mediasoup.
5. **`ARCH-005` (#41)**: Threat model v1 — rooms, events, extension, chat, media.

## 6. Human-only actions (never automate)

Approving production deployments · store submissions · account creation ·
buying domains · handling tokens/secrets · legal sign-off.

---

### End-of-session checklist

- [x] All PRs merged or explicitly parked
- [x] `dev` green
- [x] Board reflects reality (4 columns: Backlog, In Progress, In Review, Done)
- [x] **Section 5 "NOW" rewritten for the next session**
