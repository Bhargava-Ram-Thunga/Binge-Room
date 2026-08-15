# Contributing to Huddly

Thanks for helping build Huddly. This guide covers the branching model, how work moves
from an idea to production, and what CI expects from every change.

## Quick start

```bash
pnpm install
pnpm test        # unit tests across the workspace
pnpm lint        # eslint + prettier check
pnpm typecheck   # tsc across all packages
pnpm build       # compile all packages
```

Requires Node >= 22 and pnpm 11.

## Branching model

Three protected long-lived branches, promoted in one direction:

```text
feature/* ──▶ dev ──▶ main ──▶ prod
              │        │        │
           staging  release  production
                      candidate
```

- **`dev`** — integration/staging. All feature work merges here first. Default branch.
- **`main`** — stable release candidate. Only accepts promotions from `dev` (or `hotfix/*`).
- **`prod`** — production. Only accepts promotions from `main` (or `hotfix/*`).

None of the three accept direct pushes. Every change arrives through a pull request.

### Working branches

Name them `<type>/<short-description>`, all lowercase:

```text
feat/room-invite-links
fix/seek-drift-on-reconnect
docs/adapter-lifecycle
ci/playwright-matrix
hotfix/token-refresh-crash
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `hotfix`.
CI rejects branch names that don't match.

Emergencies: a `hotfix/*` branch may PR directly into `main` or `prod`; port the fix back to `dev`
in the same session so the branches don't diverge.

## Commits and PR titles

Both follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(sync): add tiered drift correction
fix(rooms): reject expired invite codes
docs(readme): document the join flow
```

The PR title is validated in CI because squash-merges use it as the commit message.

## What CI runs on every PR

| Check         | What it does                                        |
| ------------- | --------------------------------------------------- |
| Docs lint     | markdownlint across all `*.md`                      |
| Lint & format | eslint + prettier                                   |
| Typecheck     | `tsc` across every package                          |
| Unit tests    | Vitest on Node 22 and 24, with coverage             |
| Build         | compiles all packages, uploads artifacts            |
| CodeQL        | security/quality analysis for TS and Actions        |
| Secret scan   | gitleaks over the full history                      |
| PR validation | conventional title, branch name, legal merge target |

`CI passed` is the single required status check — it aggregates the jobs above.

## Definition of Done

A change is done when it has:

- implementation,
- tests covering the behaviour (including failure paths),
- error handling,
- a security consideration where relevant,
- documentation updates,
- telemetry where appropriate,
- passing CI and code review,
- its issue's acceptance criteria demonstrably met.

## Tests

Every package owns its tests next to the source as `*.test.ts`. Pure logic
(protocol validation, sync math, permission evaluation) must be exhaustively unit tested —
these are the parts that are cheapest to test and most expensive to get wrong.

```bash
pnpm test                    # everything
pnpm --filter @huddly/sync-engine test    # one package
pnpm test:coverage           # with coverage report
```

## Board workflow

Issues move through: Backlog → Research → Ready → In Progress → Blocked → Code Review →
Testing → QA / UAT Sign-off → Ready for Release → Done.

Move your issue to **Code Review** when you open the PR, **Testing** when CI is green,
and **QA / UAT Sign-off** when it's deployed to staging and awaiting verification.
