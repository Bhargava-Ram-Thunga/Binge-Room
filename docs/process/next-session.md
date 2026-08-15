# Next Session — agent handoff

Living handoff for whichever agent/IDE picks up the work (Claude Code,
Antigravity, Cursor…). **Update the "Now" section at the end of every session.**

Last updated: 15 Aug 2026, after completing ARCH-014, ARCH-010, and ARCH-011.

---

## 1. What Huddly is

Open-source watch-together platform. Everyone watches in **their own browser**;
the server synchronizes **playback state, not pixels**. Browser extension +
Node/TypeScript backend. Read [ROADMAP.md](../../ROADMAP.md) and
[release-plan.md](release-plan.md) before starting.

## 2. Repo state (as of this handoff)

|                |                                                                             |
| -------------- | --------------------------------------------------------------------------- |
| Repo           | `Bhargava-Ram-Thunga/Huddly` (public, Apache-2.0)                           |
| Default branch | `dev`                                                                       |
| Branches       | `dev` → `main` → `prod` only. All three protected.                          |
| Stack          | pnpm workspaces + Turborepo + TypeScript strict + Vitest                    |
| Packages       | `packages/protocol`, `packages/sync-engine` (seeded, validated, tested)     |
| Specs          | `docs/MVP.md`, `docs/protocol/v1.md`, `docs/database/schema-v1.md` (frozen) |
| Missing        | `apps/`, `services/` — declared in workspace, not created yet               |
| Board          | Project #3 "Huddly Roadmap", fully automated                                |
| Milestones     | M0…M12, due dates set. **M0 due 30 Aug 2026.**                              |

## 3. Non-negotiable working rules

Branch protection **will** reject violations. Follow exactly:

1. **Never commit to `dev`, `main`, or `prod` directly.** Always a feature branch + PR.
2. **Branch name** must match:
   `^(feat|fix|docs|refactor|perf|test|build|ci|chore|hotfix)/[a-z0-9._-]+$`
   e.g. `docs/protocol-v1`, `feat/room-service`.
3. **PR title** must be conventional commits:
   `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(scope\))?!?: .+`
4. **PR base is `dev`.** Never open a PR straight to `main`/`prod`; the "Merge
   target" check enforces `feature → dev → main → prod`.
5. **Link the issue** with `Closes #NN` in the PR body — board automation depends
   on it.
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
moves them: PR opened → Code Review, merged to `dev` → Testing, staging deploy
green → QA / UAT Sign-off, `main` → Ready for Release, prod deploy → Done.

## 5. NOW — Next Steps for M0 / M1

M0 Core Specifications completed:

- [x] **ARCH-014 MVP scope freeze (#50)** $\to$ [`docs/MVP.md`](../MVP.md) merged.
- [x] **ARCH-010 Protocol v1 (#46)** $\to$ [`docs/protocol/v1.md`](../protocol/v1.md) + `@huddly/protocol` envelope/payload Zod validators and tests merged.
- [x] **ARCH-011 Database schema v1 (#47)** $\to$ [`docs/database/schema-v1.md`](../database/schema-v1.md) with full ERD merged.

### Immediate Next Tasks (Dependency Order)

#### Task 1 — ADR Sets & Threat Model (M0 Completion)

- **ARCH-006 (#42)**: ADR-001..003 — WebRTC, SFU topology, LiveKit vs mediasoup
- **ARCH-007 (#43)**: ADR-004..006 — PostgreSQL, Redis boundaries, WebSockets
- **ARCH-008 (#44)**: ADR-007..009 — TypeScript everywhere, modular monolith, monorepo
- **ARCH-009 (#45)**: ADR-010..012 — Extension architecture, sync algorithm, adapter architecture
- **ARCH-005 (#41)**: Threat model v1 — rooms, events, extension, chat, media

#### Task 2 — Monorepo & Infrastructure Foundation (Phase 1 / M1)

- **FOUND-001 (#52)**: Scaffold `apps/` (extension, web) and `services/` (api, realtime).
- **FOUND-009 (#60)**: Docker Compose dev environment (Postgres + Redis).
- **FOUND-010 (#61)**: Typed environment/config management.

## 6. Paste-ready prompt for another agent

> Read `docs/process/next-session.md` in this repo and follow it exactly.
> Check Section 5 "NOW" for the current task list. For each task: create the named
> feature branch, do the work, run `pnpm lint && pnpm typecheck && pnpm test` plus
> `npx markdownlint-cli2`, commit with a conventional-commit message, push, and
> open a PR based on `dev` with `Closes #NN` in the body. Do not commit directly
> to `dev`/`main`/`prod`. Stop and ask before any production deployment.

## 7. Known issues to fix sometime

- **Board rule conflict**: `S16` (issue closed → Done) races with the release
  train, so an issue closed by a merge can land in QA/UAT or Done depending on
  timing. Fix: only apply S16 when the issue is closed _without_ a merged PR.
- **#57 (CI) is closed but incomplete** — Turbo `lint` task and branch-protection
  notes were never finished. Reopen or file a follow-up.
- **No production smoke tests** in `cd.yml`; add with rollback when real deploys land.
- `FOUND-001` is only partly done: `apps/` and `services/` don't exist yet.

## 8. Human-only actions (never automate)

Approving production deployments · store submissions · account creation ·
buying domains · handling tokens/secrets · legal sign-off.

---

### End-of-session checklist

- [x] All PRs merged or explicitly parked
- [x] `dev` green
- [x] Board reflects reality
- [x] **Section 5 "NOW" rewritten for the next session**
