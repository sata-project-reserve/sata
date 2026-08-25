import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const QUEUE_PATH = join('public', 'executive-approval-queue.json');
const queue = JSON.parse(await readFile(QUEUE_PATH, 'utf8'));
const [, , command = 'plan'] = process.argv;

switch (command) {
  case 'plan':
    printPlan();
    break;
  default:
    throw new Error(`Unknown executive approval command: ${command}. Use plan.`);
}

function printPlan() {
  const counts = {};
  for (const item of queue.items ?? []) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  const reviewItems = (queue.items ?? []).filter(
    (item) => item.status === 'ready-for-chairman-review'
  );
  console.log(
    JSON.stringify(
      {
        project: queue.project,
        mode: queue.mode,
        executiveChairman: queue.executiveChairman,
        counts,
        chairmanReview: reviewItems.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          execution: item.execution,
          proposedAction: item.proposedAction
        })),
        operatingBoundary:
          'Agents prepare and validate work. The Executive Chairman approves final transactions, proposals, promotions, partnerships, and public commitments.'
      },
      null,
      2
    )
  );
}
