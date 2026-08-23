#!/usr/bin/env bash
set -euo pipefail
msg_file="$1"
pattern='(claude|copilot|cursor|anthropic|openai|gemini|antigravity|codeium|devin)'
if grep -iE "co-authored-by:.*$pattern" "$msg_file"; then
  echo "Commit message contains an AI Co-Authored-By trailer. Remove it." >&2
  exit 1
fi
