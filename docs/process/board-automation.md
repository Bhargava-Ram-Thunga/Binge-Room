# Board Automation — Scenarios

The "Huddly Roadmap" project board is driven by automation. A card's **Status**
should never need to be dragged by hand: work events (labels, PRs, reviews,
merges, deployments) move it.

This document is the specification. `.github/workflows/project-automation.yml`
implements it; `.github/scripts/board-sync.sh` and `board-sweep.sh` do the work.

## Status columns

`Backlog → Research → Ready → In Progress → Blocked → Code Review → Testing →
QA / UAT Sign-off → Ready for Release → Done`

## Scenario matrix

| #   | Trigger (what happens)                                 | Board reaction                                           |
| --- | ------------------------------------------------------ | -------------------------------------------------------- |
| S1  | Issue opened                                           | Added to board → **Backlog**                             |
| S2  | Issue labeled `status:needs-research` / `needs-design` | → **Research**                                           |
| S3  | Issue labeled `status:ready`                           | → **Ready**                                              |
| S4  | Issue labeled `status:blocked`                         | → **Blocked**                                            |
| S5  | Label `status:blocked` removed                         | → **Ready**                                              |
| S6  | Issue assigned to someone                              | → **In Progress**                                        |
| S7  | Draft PR opened                                        | PR + its linked issues → **In Progress**                 |
| S8  | PR marked ready for review                             | PR + linked issues → **Code Review**                     |
| S9  | Review requests changes                                | → **In Progress**                                        |
| S10 | PR converted back to draft                             | → **In Progress**                                        |
| S11 | PR closed without merging                              | → **Backlog**                                            |
| S12 | PR merged into `dev`                                   | PR + linked issues → **Testing**                         |
| S13 | Staging deploy succeeds (CD on `dev`)                  | Sweep: everything in **Testing** → **QA / UAT Sign-off** |
| S14 | PR merged into `main` (release candidate)              | PR + linked issues → **Ready for Release**               |
| S15 | Production deploy succeeds (CD on `prod`)              | Sweep: everything in **Ready for Release** → **Done**    |
| S16 | Issue closed                                           | → **Done**                                               |
| S17 | Issue reopened                                         | → **Backlog**                                            |

### Why sweeps for S13/S15

Deployments are release trains, not per-issue events: a staging deploy validates
everything merged since the last one. So deploy success moves the whole column
forward rather than trying to map a deployment back to individual issues.

**QA / UAT Sign-off is deliberately manual on the way out.** Automation moves
cards _into_ that column; a human moves them out (or promotes `dev` → `main`,
which triggers S14). That is the sign-off gate.

## Flow through the pipeline

```text
issue opened ──→ Backlog ──(label)──→ Research/Ready ──(assign)──→ In Progress
                                                                      │
                                                          draft PR ───┘
                                                                      │
                                                    ready for review ──→ Code Review
                                                                      │
                                                        merge to dev ──→ Testing
                                                                      │
                                              staging deploy green ────→ QA / UAT Sign-off
                                                                      │
                                              promote dev → main ──────→ Ready for Release
                                                                      │
                                          production deploy green ─────→ Done
```

## Setup requirement — `PROJECT_TOKEN`

The default `GITHUB_TOKEN` **cannot write to user-owned Projects v2**. The
automation therefore needs a Personal Access Token stored as the repository
secret `PROJECT_TOKEN`:

1. Create a classic PAT with the `repo` and `project` scopes (or a fine-grained
   token with read/write on Projects + Issues + Pull requests).
2. Add it at **Settings → Secrets and variables → Actions → New repository
   secret**, named `PROJECT_TOKEN`.

Without the secret every automation job **skips with a warning** instead of
failing, so CI stays green until it is configured.

## Built-in project workflows (enable in the project UI)

These GitHub-native automations complement the Actions above and cost nothing:

- **Auto-add to project** — filter `is:issue,pr is:open` (belt-and-braces for S1).
- **Item closed** → set Status **Done**.
- **Auto-archive items** — archive `is:closed updated:<@today-2w`.

## Board field conventions

- **Status** — owned by automation (this document).
- **Phase / Priority / Difficulty** — set by humans at triage; never automated.
- Labels remain the source of truth for `type:*` and `area:*`; the board mirrors
  them for filtering.
