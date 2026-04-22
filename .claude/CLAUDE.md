# BingeRoom — Master Session Prompt
# Works for both Claude Pro (via subscription) and Gemma 4 (via Ollama fallback)
# Auto-read by Claude Code at start of every session
## Project Board Lifecycle Automation
When managing tasks on the GitHub project board:
- **Building**: Move a card to "Building" when active implementation begins.
- **In Review**: Move a card to "In Review" when a PR is raised.
- **Reversion**: Move a card back to "Building" if a PR is rejected/requested changes.
- **Shipped**: Move a card to "Shipped" only after the PR is merged.
- **Closed**: Close the GitHub issue only AFTER the card is moved to "Shipped".
Columns: `backlog`, `building`, `inreview`, `shipped`.

---

## MODEL DETECTION & BEHAVIOR — READ THIS FIRST

If you are Claude (Sonnet/Opus via Pro subscription):
- You hold full context across long sessions.
- You naturally execute the ULTRATHINK protocol (see below) before coding.
- Follow instructions as written and pause before git push.
- **Council Approval**: For all strategic architectural decisions or major feature changes, you MUST invoke the `llm-council-skill` to gain a multi-agent consensus before proceeding.

If you are Gemma 4 (via Ollama claude --model gemma4:31b-cloud):

If you are Gemma 4 (via Ollama claude --model gemma4:31b-cloud):
- Re-read this entire file every 30 minutes during long sessions.
- Run `/plan:status` after every single task.
- You lack Claude's innate planning; you MUST explicitly output the ULTRATHINK block before writing any code.
- GEMMA EDIT PROTOCOL: Do not attempt to rewrite entire files if they exceed 100 lines. If file edits fail, use targeted `sed` or `awk` commands to replace specific lines, or break the file into smaller imported modules.

---

## BOOT SEQUENCE — MANDATORY EVERY SESSION

Execute in this exact order. No permission needed for any of these.
Run all commands immediately without asking:

```bash
# 1. System state
find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.turbo/*' | head -60
git branch --show-current
git log --oneline -5
git status --short
# Run tests only if files changed or explicitly requested (SKIP_BOOT_TESTS=false)
[ -z "$SKIP_BOOT_TESTS" ] && git diff --quiet HEAD || pnpm turbo test 2>&1 | tail -20

# 2. Fetch Project Board IDs (Required for milestone updates)
gh project list --owner Bhargava-Ram-Thunga
```