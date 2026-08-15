# Next Session — agent handoff

Living handoff for whichever agent/IDE picks up the work (Claude Code,
Antigravity, Cursor…). **Update the "Now" section at the end of every session.**

Last updated: 15 Aug 2026, after M0 setup.

---

## 1. What Huddly is

Open-source watch-together platform. Everyone watches in **their own browser**;
the server synchronizes **playback state, not pixels**. Browser extension +
Node/TypeScript backend. Read [ROADMAP.md](../../ROADMAP.md) and
[release-plan.md](release-plan.md) before starting.

## 2. Repo state (as of this handoff)

|                |                                                               |
| -------------- | ------------------------------------------------------------- |
| Repo           | `Bhargava-Ram-Thunga/Huddly` (public, Apache-2.0)             |
| Default branch | `dev`                                                         |
| Branches       | `dev` → `main` → `prod` only. All three protected.            |
| Stack          | pnpm workspaces + Turborepo + TypeScript strict + Vitest      |
| Packages       | `packages/protocol`, `packages/sync-engine` (seeded, tested)  |
| Missing        | `apps/`, `services/` — declared in workspace, not created yet |
| Board          | Project #3 "Huddly Roadmap", fully automated                  |
| Milestones     | M0…M12, due dates set. **M0 due 30 Aug 2026.**                |

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

## 5. NOW — the M0 critical path

Three issues, in dependency order. **Due 30 Aug 2026.**

### Task 1 — ARCH-014 MVP scope freeze (#50) · ~1–2h · do first

Create `docs/MVP.md`: the frozen MVP feature list (Chrome + Firefox extension,
web client, rooms, generic HTML5 video sync, text chat, basic roles, basic
voice), explicit **non-goals**, the 14-step MVP success script rewritten as
Given/When/Then acceptance tests, and the project Definition of Done
(implementation + tests + error handling + security consideration + docs +
telemetry + review + acceptance criteria).
Branch `docs/mvp-scope-freeze` · PR `docs: freeze MVP scope and definition of done` · `Closes #50`

### Task 2 — ARCH-010 Protocol v1 (#46) · ~4–5h · the real gate

Create `docs/protocol/v1.md`. Must define:

- **Event envelope**: `protocolVersion`, `eventId`, `eventType`, `roomId`,
  `actorId`, `revision`, `serverTimestamp`, `payload`.
- **Event catalog for MVP only**: room lifecycle, presence, playback
  (PLAY/PAUSE/SEEK/RATE/MEDIA_LOADED/BUFFERING), chat. JSON schema per event.
- **Authorization rule per event** — server verifies session + membership +
  role + permission. Never trust a client claiming to be host.
- **REST surface**: auth, rooms, invites, members.
- **Error code registry**: `SYNC_*`, `ROOM_*`, `AUTH_*`, `WEBRTC_*`.
- **Versioning/compatibility** strategy.

Then extend `packages/protocol` with the envelope types + zod validators and
**unit tests** for valid/invalid/unknown-version envelopes.
Branch `docs/protocol-v1` · `Closes #46`

Constraint: the protocol must not depend on any browser-extension API — mobile
and web clients speak the same protocol.

### Task 3 — ARCH-011 Database schema v1 (#47) · ~4h

Create `docs/database/schema-v1.md` with a **mermaid ERD** plus every table from
ROADMAP §Phase 0 (users, user_devices, rooms, room_settings, room_members,
room_permissions, media_sessions, playback_states, playback_events,
navigation_states, chat_messages, message_reactions, room_invites,
moderation_actions, audit_events). Include column types, PK/FK/unique
constraints (notably `(message_id, user_id, reaction)`), indexes for hot
queries, retention/cleanup rules per table, and the user-erasure path.
Branch `docs/database-schema-v1` · `Closes #47`

Rule: PostgreSQL is permanent truth; Redis is ephemeral only (presence, locks,
rate limits, room cache). Never make Redis a source of truth.

## 6. Paste-ready prompt for another agent

> Read `docs/process/next-session.md` in this repo and follow it exactly.
> Work Task 1 first, then Task 2, then Task 3. For each: create the named
> branch, do the work, run `pnpm lint && pnpm typecheck && pnpm test` plus
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

- [ ] All PRs merged or explicitly parked
- [ ] `dev` green
- [ ] Board reflects reality
- [ ] **Section 5 "NOW" rewritten for the next session**
