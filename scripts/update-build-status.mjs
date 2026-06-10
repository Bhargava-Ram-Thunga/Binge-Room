import { execSync } from 'child_process';
import fs from 'fs';

const PROJECT_ID = 'PVT_kwHOBd-eFs4BaSCW';
const FIELD_BUILD_STATUS = 'PVTSSF_lAHOBd-eFs4BaSCWzhVKz74';
const FIELD_STATUS = 'PVTSSF_lAHOBd-eFs4BaSCWzhVKvwk';

// Build Status option IDs
const STATUS_RUNNING = 'ddbcde41';
const STATUS_PASSED = '6e8b13a0';
const STATUS_FAILED = 'd661ec18';

// Status option IDs
const STATUS_IN_PROGRESS = '47fc9ee4';
const STATUS_DONE = '98236657';

function runGraphQL(query) {
  fs.writeFileSync('temp_ci_query.graphql', query);
  const useEnvClean = !process.env.CI ? 'env -u GITHUB_TOKEN -u GH_TOKEN ' : '';
  const cmd = `${useEnvClean}gh api graphql -F query=@temp_ci_query.graphql`;
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    fs.unlinkSync('temp_ci_query.graphql');
    return JSON.parse(result);
  } catch (err) {
    if (fs.existsSync('temp_ci_query.graphql')) fs.unlinkSync('temp_ci_query.graphql');
    console.error('GraphQL CLI Error Stderr:', err.stderr || err.message);
    throw err;
  }
}

async function main() {
  const statusArg = process.argv[2]; // 'running', 'success', or 'failure'
  if (!statusArg) {
    console.error('Usage: node scripts/update-build-status.mjs <running|success|failure>');
    process.exit(1);
  }

  let optionId = '';
  if (statusArg === 'running') optionId = STATUS_RUNNING;
  else if (statusArg === 'success') optionId = STATUS_PASSED;
  else if (statusArg === 'failure') optionId = STATUS_FAILED;
  else {
    console.error(`Unknown status: ${statusArg}`);
    process.exit(1);
  }

  // Get current branch name
  const branchName = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
  console.log(`Current branch: "${branchName}"`);

  // Extract Task ID (e.g. BR-202 from feat/BR-202 or BR-202-jiohotstar or commit message)
  let taskMatch = branchName.match(/BR-\d+/i);
  if (!taskMatch) {
    // If not found in branch name, attempt to search the git commit message
    try {
      const commitMsg = execSync('git log -1 --pretty=%B', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      taskMatch = commitMsg.match(/BR-\d+/i);
      if (taskMatch) {
        console.log(`Found Task ID in commit message: "${taskMatch[0]}"`);
      }
    } catch (e) {
      console.error('Failed to query git commit message:', e.message);
    }
  }

  if (!taskMatch) {
    console.log('No Task ID (e.g., BR-XXX) detected in branch name or commit message. Skipping project update.');
    process.exit(0);
  }

  const taskId = taskMatch[0].toUpperCase();
  console.log(`Detected Task ID: "${taskId}"`);

  // Query project items to find the corresponding card
  console.log('Fetching project board items...');
  const query = `
    query {
      node(id: "${PROJECT_ID}") {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  title
                }
                ... on PullRequest {
                  title
                }
                ... on DraftIssue {
                  title
                }
              }
            }
          }
        }
      }
    }
  `;

  let items = [];
  try {
    const data = runGraphQL(query);
    items = data.data.node.items.nodes;
  } catch (e) {
    console.error('Failed to query project items:', e.message);
    process.exit(1);
  }

  // Find the item starting with our Task ID
  const item = items.find(n => {
    const title = n.content?.title || '';
    return title.toUpperCase().startsWith(`${taskId}:`);
  });

  if (!item) {
    console.log(`No matching project card found starting with "${taskId}:". Skipping update.`);
    process.exit(0);
  }

  console.log(`Found matching project card: "${item.content.title}" (ID: ${item.id})`);
  console.log(`Updating Build Status on board to: "${statusArg.toUpperCase()}"...`);

  // Mutation to update single-select field Build Status
  const editBuildMutation = `
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${PROJECT_ID}",
        itemId: "${item.id}",
        fieldId: "${FIELD_BUILD_STATUS}",
        value: {
          singleSelectOptionId: "${optionId}"
        }
      }) {
        projectV2Item { id }
      }
    }
  `;

  try {
    runGraphQL(editBuildMutation);
    console.log('Build status updated successfully on GitHub Project board!');

    // Automatically update item's Status field
    let targetStatus = '';
    const eventName = process.env.GITHUB_EVENT_NAME || '';
    const isPushEventToTarget = eventName === 'push' && (process.env.GITHUB_REF_NAME === 'dev' || process.env.GITHUB_REF_NAME === 'prod');
    const isDirectDevOrProd = branchName === 'dev' || branchName === 'prod';

    if (statusArg === 'running') {
      targetStatus = STATUS_IN_PROGRESS;
      console.log('Moving task status to: "IN PROGRESS"...');
    } else if (statusArg === 'success' && (isDirectDevOrProd || isPushEventToTarget)) {
      targetStatus = STATUS_DONE;
      console.log('Moving task status to: "DONE" (branch is dev/prod or push to target)...');
    }

    if (targetStatus) {
      const editStatusMutation = `
        mutation {
          updateProjectV2ItemFieldValue(input: {
            projectId: "${PROJECT_ID}",
            itemId: "${item.id}",
            fieldId: "${FIELD_STATUS}",
            value: {
              singleSelectOptionId: "${targetStatus}"
            }
          }) {
            projectV2Item { id }
          }
        }
      `;
      runGraphQL(editStatusMutation);
      console.log('Task column status updated successfully!');
    }
  } catch (e) {
    console.error('Failed to update project board item fields:', e.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
