#!/usr/bin/env bash
# Shared helpers for Huddly project-board automation.
# Requires: gh CLI authenticated with a token that can write Projects v2
# (see docs/process/board-automation.md).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-PVT_kwHOBd-eFs4BaSCW}"
STATUS_FIELD_ID="${STATUS_FIELD_ID:-PVTSSF_lAHOBd-eFs4BaSCWzhVKvwk}"

# Status name → single-select option id
status_option_id() {
  case "$1" in
  "Backlog") echo "9549981e" ;;
  "Research") echo "125c20cc" ;;
  "Ready") echo "a9701f89" ;;
  "In Progress") echo "11b64dd9" ;;
  "Blocked") echo "98303428" ;;
  "Code Review") echo "4de3583a" ;;
  "Testing") echo "5e2bb994" ;;
  "QA / UAT Sign-off") echo "fb4a8210" ;;
  "Ready for Release") echo "31965ac5" ;;
  "Done") echo "466da322" ;;
  *)
    echo "Unknown status: $1" >&2
    return 1
    ;;
  esac
}

# Add content (issue/PR node id) to the project if absent, echo the item id.
# addProjectV2ItemById is idempotent: it returns the existing item when present.
board_item_for_content() {
  gh api graphql -f query='
    mutation($project:ID!, $content:ID!) {
      addProjectV2ItemById(input:{projectId:$project, contentId:$content}) {
        item { id }
      }
    }' -f project="$PROJECT_ID" -f content="$1" \
    -q '.data.addProjectV2ItemById.item.id'
}

# Set the Status field of a project item.
board_set_status() {
  local item_id="$1" status="$2" option_id
  option_id="$(status_option_id "$status")"
  gh api graphql -f query='
    mutation($project:ID!, $item:ID!, $field:ID!, $option:String!) {
      updateProjectV2ItemFieldValue(input:{
        projectId:$project, itemId:$item, fieldId:$field,
        value:{ singleSelectOptionId:$option }
      }) { projectV2Item { id } }
    }' -f project="$PROJECT_ID" -f item="$item_id" \
    -f field="$STATUS_FIELD_ID" -f option="$option_id" >/dev/null
}

# Convenience: content node id + status → ensure on board and set status.
board_move_content() {
  local content_id="$1" status="$2" item_id
  item_id="$(board_item_for_content "$content_id")"
  board_set_status "$item_id" "$status"
  echo "moved content $content_id → $status"
}

# Issues that a PR will close (GraphQL closingIssuesReferences), one node id per line.
pr_linked_issue_ids() {
  local owner="$1" repo="$2" number="$3"
  gh api graphql -f query='
    query($owner:String!, $repo:String!, $number:Int!) {
      repository(owner:$owner, name:$repo) {
        pullRequest(number:$number) {
          closingIssuesReferences(first:50) { nodes { id } }
        }
      }
    }' -f owner="$owner" -f repo="$repo" -F number="$number" \
    -q '.data.repository.pullRequest.closingIssuesReferences.nodes[].id'
}
