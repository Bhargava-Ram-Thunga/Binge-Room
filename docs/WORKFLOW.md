# BingeRoom — Branch Rules, Rulesets, and Workflow Guide
# Read this before writing a single line of code.
# This is the source of truth for how we work on this project.

---

## The Five Branches

```
prod
 └── dev
      ├── feat/monorepo-setup
      ├── feat/shared-types
      ├── feat/ws-server
      ├── fix/some-bug
      └── hotfix/critical-prod-fix
```

Every branch has a purpose. Work only on the correct branch for what you are doing.

---

## Branch 1 — prod

**What it is:** Production. What real users run.

**The rule:** Nothing ever goes directly here. You never touch this branch.
The only way code gets to prod is through a PR from dev, after both team
members have reviewed and approved it, and after all CI checks pass.

**Ruleset applied:**
- 2 approvals required on every PR — both Bhargava and Dinesh must approve
- Signed commits required — every commit is cryptographically verified
- Linear history required — no merge bubbles, one straight line in git log
- No force pushes — ever
- No deletions — prod must always exist
- All three CI jobs must pass: Test, Type check, Build
- Stale reviews dismissed — if you push a new commit after approval, the
  other person must re-approve
- Last push approval required — the person who pushed last cannot self-approve
- Bypass: repo admin only, for genuine production emergencies only

**When you merge to prod:** End of each completed milestone phase, when
dev is fully stable and tested. Both of you agree, both approve, it merges.

---

## Branch 2 — dev

**What it is:** Integration. Where all completed feature work lands daily.

**The rule:** You never code directly on dev. You open a PR from your
feature branch, the other person reviews it, it merges here. At end of
every working day, everything completed that day should be on dev.

**Ruleset applied:**
- 1 approval required — the other person must review your PR
- No force pushes — ever
- No deletions — dev must always exist
- Two CI jobs must pass: Test, Type check (Build runs on prod PRs)
- Stale reviews dismissed — new commit after approval requires re-review
- No linear history requirement — dev can have merge commits

**When you merge to dev:** Every time a feature branch task is complete,
tested, and the PR is approved. This happens multiple times per day.

---

## Branch 3 — feat/*

**What it is:** Where you actually write code. One branch per milestone.

**Naming format:**
```
feat/monorepo-setup
feat/shared-types
feat/database-schema
feat/backend-scaffold
feat/supabase-auth
feat/room-create
feat/ws-server
feat/sync-engine
feat/ws-handlers
feat/extension-scaffold
feat/yt-content-script
feat/overlay-ui
feat/overlay-components
feat/video-audio-call
feat/web-pages
feat/integration-tests
feat/security-audit
feat/performance
feat/alpha-deploy
```

**Ruleset applied:**
- No force pushes — this is the only rule
- No PR required to push — you push directly to your feature branch all day
- No CI required on push — CI only runs when you open a PR to dev
- No approvals on the branch itself

**Why so light:** Feature branches are personal working space. Too many
rules on feature branches means developers bypass the rules entirely.
The protection that matters happens when the code moves to dev and prod.

**Lifecycle of a feat/* branch:**
```
1. Branch from dev
2. Push commits throughout the day (Claude Code does this automatically)
3. When milestone is done: open PR to dev
4. Other person reviews and approves
5. Squash merge to dev
6. Delete the feat/* branch — it is done
```

---

## Branch 4 — fix/*

**What it is:** Bug fixes found during development.

**Naming format:**
```
fix/ws-upgrade-crash
fix/drift-correction-seek
fix/feedback-loop-guard
fix/chat-not-broadcasting
```

**Ruleset applied:** Same as feat/* — no force pushes only.

**Lifecycle:** Same as feat/* — branch from dev, fix, PR to dev, merge, delete.

---

## Branch 5 — hotfix/*

**What it is:** Emergency fixes for bugs found in production (prod branch).
These bypass the normal feat → dev → prod flow because something is
actively broken for users right now.

**Naming format:**
```
hotfix/invite-token-expired
hotfix/ws-connection-drop
hotfix/room-close-not-firing
```

**Ruleset applied:**
- No force pushes
- No deletions — hotfix branches are preserved for audit
- More restricted than feat/* because they go directly to prod

**Lifecycle — this is different from normal branches:**
```
1. Branch FROM prod (not dev)
2. Fix the bug
3. Open PR to prod — requires 2 approvals (emergency does not skip review)
4. After prod merge: immediately also merge to dev
   (dev must stay in sync with prod fixes)
5. Tag the prod release: git tag -a v0.1.1 -m "hotfix: description"
```

**When to use hotfix vs fix:**
- fix/* = bug found during development, not in production yet → normal flow
- hotfix/* = bug found in production, users are affected right now → emergency flow

---

## Complete Daily Workflow

### Starting your day

```bash
# 1. Go to your working directory
cd Binge-Room

# 2. Pull latest from dev into your feature branch
git checkout dev
git pull origin dev
git checkout feat/your-current-branch
git merge dev

# 3. If merge conflict: fix it now before doing anything else
# A conflict at start of day is easier than a conflict at end of day

# 4. Check tests are green before you start
pnpm turbo test

# 5. Open Codespaces OR open Claude Code locally
# For backend/web/shared work: open Codespaces
# For extension Chrome testing: stay local
```

### During the day

Claude Code handles commits and pushes automatically after every task.
Your job during a session is:

```
- Start Claude Code: claude
- Paste the session task at the bottom of the prompt
- Watch the boot report
- Confirm when Claude Code asks for confirmation
- Read the ⚠ BLOCKED outputs and make decisions
- Read the task complete reports after each push
```

You do not manually commit during a Claude Code session.
Claude Code commits after every task, not at the end of the session.

### Opening a PR

When a milestone is fully done and all tasks are committed:

```bash
# Push the final state
git push origin feat/your-branch

# Open PR via gh CLI
gh pr create \
  --base dev \
  --title "feat(scope): M[N] — milestone name" \
  --body "Closes #ISSUE_NUMBER"

# OR open it on GitHub:
# github.com/Bhargava-Ram-Thunga/Binge-Room/compare/dev...feat/your-branch
```

The PR template will appear. Fill in every checkbox before requesting review.
A PR with unchecked boxes will not be approved.

### Reviewing a PR

When the other person opens a PR:

```bash
# Pull their branch and test it locally or in Codespaces
git fetch origin
git checkout feat/their-branch
pnpm turbo test
pnpm turbo build
```

If tests pass and code looks correct: approve on GitHub.
If something is wrong: leave a review comment explaining exactly what.
Never approve a PR with failing tests.

### Merging a PR

After approval:
- PRs to dev: squash merge (keeps dev history clean, one commit per feature)
- PRs to prod: merge commit (preserves the full history for audit)

After merging: delete the feature branch on GitHub.

### Ending your day

```bash
# Confirm everything is pushed
git status
# Should show: nothing to commit, working tree clean

# If anything is uncommitted — commit and push before stopping
git add [files]
git commit -m "wip(scope): work in progress — [what is done so far]"
git push origin feat/your-branch

# If using Codespaces: STOP the Codespace, do not just close the tab
# github.com/codespaces → find your Codespace → Stop
```

Send the handoff note to the other person (Claude Code generates this
at end of every session — copy it and send it).

### End of week

```bash
# Confirm dev is stable
git checkout dev
git pull origin dev
pnpm turbo test
pnpm turbo build
# Both must pass with zero errors

# If the week's milestone is complete:
# Open PR from dev to prod
gh pr create --base prod --title "release: Phase 1 milestone M[N]"
# Both people approve it
# Merge it
# Tag the release:
git tag -a v0.1.[N] -m "Phase 1 M[N] complete"
git push origin v0.1.[N]
```

If the milestone is not complete: do not merge to prod.
prod only receives completed, tested, both-approved work.

---

## Commit Message Format

Every commit follows this format exactly:

```
type(scope): description in present tense
```

**Types:**

| Type | When to use |
|------|-------------|
| feat | New feature or capability |
| fix | Bug fix |
| test | Adding or fixing tests |
| refactor | Code change with no behavior change |
| chore | Config, deps, scripts, setup |
| security | Auth, tokens, input validation fix |
| perf | Performance improvement |
| docs | Documentation only |

**Scopes:**

| Scope | What it covers |
|-------|---------------|
| shared | packages/shared |
| backend | packages/backend (general) |
| ws | WebSocket server and handlers |
| rest | Fastify REST routes |
| auth | Auth endpoints and middleware |
| db | Prisma schema and migrations |
| redis | Redis client and utilities |
| sync | Sync engine |
| ext | packages/extension (general) |
| content | Extension content script |
| overlay | Extension overlay UI |
| web | packages/web |
| env | Environment files and validation |
| monorepo | Root-level workspace config |

**Examples:**
```
feat(shared): add WsEvent discriminated union with 11 event types
test(shared): add 13 rigorous time utility tests GREEN
feat(ws): add upgrade handler with pre-await header reads
fix(ws): guard ytPlayer feedback loop with isApplyingRemote flag
test(auth): add 12 attack cases for JWT middleware
security(auth): validate invite token signature before room join
feat(overlay): add ChatPanel with auto-scroll and typing indicator
chore(monorepo): add pnpm workspace root and turbo config
perf(ext): reduce overlay bundle from 340kb to 180kb
docs(db): add complete schema reference for all 7 models
```

---

## CI — What Runs and When

Three jobs run on every PR to dev or prod:

**Job 1 — Test**
Runs: pnpm turbo test
Passes when: zero test failures across all packages
If fails: PR cannot be merged to dev

**Job 2 — Type check**
Runs: pnpm turbo type-check
Passes when: tsc --strict passes with zero errors in all packages
If fails: PR cannot be merged to dev

**Job 3 — Build**
Runs: pnpm turbo build
Depends on: Test and Type check both passing first
Passes when: all packages build without errors
If fails: PR cannot be merged to prod (required for prod only)

CI does NOT run on pushes to feat/* or fix/* branches.
It only runs when you open a PR to dev or prod.
This keeps CI fast and cheap — you are not burning CI minutes on every small commit.

---

## Project Board

Board: https://github.com/users/Bhargava-Ram-Thunga/projects/1

**Column meanings:**

| Column | Meaning |
|--------|---------|
| Backlog | Not started, waiting its turn |
| Building | Actively being implemented right now |
| Review | PR is open, waiting for approval |
| Shipped | Merged to dev (or prod for releases) |

**Rules:**
- Move the issue to Building when you start the feat/* branch
- Move to Review when the PR is opened
- Move to Shipped when the PR is merged to dev
- Never leave something in Building if you stopped working on it
- Never have more than 4 issues in Building simultaneously

Claude Code updates the board automatically using gh CLI after every task.
If it cannot (gh CLI not authenticated), it outputs the command for you to run.

---

## What Goes to GitHub vs Stays Local

**Committed to GitHub (safe, no secrets):**
```
.claude/CLAUDE.md          ← master session prompt, same for everyone
.github/workflows/ci.yml   ← CI pipeline
.github/CODEOWNERS         ← review rules
.github/pull_request_template.md
.github/ISSUE_TEMPLATE/*
.github/dependabot.yml
.devcontainer/devcontainer.json  ← Codespaces config
.env.example               ← template with blank values
docs/*.md                  ← all documentation
packages/**/src/**         ← all source code
```

**Stays local only (secrets or generated):**
```
.env                       ← your actual credentials, never commit this
.claude/settings.json      ← your local Claude Code model config
.claude/settings.local.json
docs/superpowers/          ← Claude Code internal planning files
findings.md                ← Claude Code generated
progress.md                ← Claude Code generated
task_plan.md               ← Claude Code generated
node_modules/
dist/
.turbo/
coverage/
```

---

## Codespaces vs Local

| Task | Where |
|------|-------|
| Backend code | Codespaces |
| Web app code | Codespaces |
| Shared types | Codespaces |
| Running tests | Codespaces |
| Claude Code sessions | Codespaces |
| Database migrations | Codespaces |
| Ladle component stories | Codespaces |
| Extension Chrome testing | Local Mac only |
| Loading extension into Chrome | Local Mac only |
| Testing overlay on YouTube | Local Mac only |

**Sync between Codespaces and local:**
```bash
# After working in Codespaces, switch to local:
git pull origin dev  # or feat/your-branch

# After working locally on extension:
git push origin feat/your-branch
# Then pull in Codespaces if needed
```

Never copy files manually. Git handles all sync.

---

## Common Mistakes and How to Avoid Them

**Mistake 1 — Pushing directly to dev or prod**
Both branches have rulesets blocking direct push.
If you try: git will reject it with an error.
Fix: always work on feat/* and open a PR.

**Mistake 2 — Forgetting to pull dev before starting**
You code all day on a stale branch. Merge conflict at end of day.
Fix: always run git pull origin dev and git merge dev at start of day.

**Mistake 3 — Committing .env**
Your Supabase credentials, Redis URL, and JWT secrets go to GitHub.
.env is in .gitignore but git add . can sometimes override this.
Fix: never use git add . — always git add [specific files].
Run: git check-ignore -v .env before every push to confirm it is ignored.

**Mistake 4 — Batching commits at end of session**
You code for 4 hours and make one giant commit.
If something breaks you cannot tell which change caused it.
Fix: Claude Code commits after every task automatically. Let it.

**Mistake 5 — Force pushing to a shared branch**
You rebase your branch and force push. The other person's local copy of
that branch now has a different history. They get painful conflicts.
Fix: never force push to any branch. Rulesets block it on prod and dev.
On feat/* it is technically allowed but should never be done if the other
person has checked out your branch.

**Mistake 6 — Not stopping Codespaces**
You close the browser tab. Codespaces keeps running. Burns your monthly
hours while you sleep.
Fix: always go to github.com/codespaces and click Stop when done.
Codespaces auto-stops after 30 minutes of inactivity but never rely on this.

**Mistake 7 — Merging without running tests**
PR looks fine but you did not pull and run tests locally.
Something is broken in a package you did not touch.
Fix: always run pnpm turbo test on the feature branch before approving any PR.

---

## Quick Reference Card

```
Starting work today:
  git checkout dev && git pull origin dev
  git checkout feat/your-branch && git merge dev
  pnpm turbo test

During session:
  claude ← Claude Code reads CLAUDE.md automatically
  paste session task ← only thing you type

Opening PR:
  gh pr create --base dev --title "feat(scope): M[N] — name"

Reviewing PR:
  git checkout feat/their-branch
  pnpm turbo test && pnpm turbo build
  approve on GitHub if green

End of day:
  git status ← must show clean
  Stop your Codespace if using one

Emergency prod fix:
  git checkout prod && git pull origin prod
  git checkout -b hotfix/description
  fix → PR to prod → 2 approvals → merge
  git checkout dev && git merge prod && git push origin dev
```

---

## Contacts

Bhargava-Ram-Thunga — github.com/Bhargava-Ram-Thunga
Dinesh-Reddy-Siramgari — github.com/Dinesh-Reddy-Siramgari

Repository: github.com/Bhargava-Ram-Thunga/Binge-Room
Project board: github.com/users/Bhargava-Ram-Thunga/projects/1