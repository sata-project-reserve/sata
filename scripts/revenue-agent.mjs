import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PLAN_PATH = join('public', 'revenue-operating-plan.json');
const QUEUE_PATH = join('public', 'executive-approval-queue.json');
const LEDGER_PATH = join('public', 'sats-generation-ledger.json');

const [, , command = 'plan'] = process.argv;

const [plan, queue, ledger] = await Promise.all([
  readJson(PLAN_PATH),
  readJson(QUEUE_PATH),
  readJson(LEDGER_PATH)
]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  default:
    throw new Error(`Unknown revenue command: ${command}. Use plan.`);
}

function printPlan() {
  const openRevenueApprovals = (queue.items ?? []).filter(
    (item) => item.category === 'revenue-action' && !['executed', 'rejected', 'superseded'].includes(item.status)
  );

  console.log(
    JSON.stringify(
      {
        project: plan.project,
        mode: plan.mode,
        objective: plan.objective,
        nextCycle: plan.nextCycle,
        offers: plan.revenueStreams.map((stream) => ({
          id: stream.id,
          label: stream.label,
          priceUsd: stream.priceUsd,
          deliverable: stream.deliverable
        })),
        allocationPolicy: plan.allocationPolicy.postReceiptAllocationPercent,
        satsGeneration: {
          objective: ledger.objective,
          currentReserveSats: ledger.target.currentReserveSats,
          remainingSats: ledger.target.remainingSats,
          openPipeline: ledger.pipeline.map((item) => ({
            id: item.id,
            stage: item.stage,
            targetRevenueUsd: item.targetRevenueUsd,
            nextAction: item.nextAction
          })),
          receipts: ledger.receipts.length,
          allocations: ledger.allocations.length
        },
        openRevenueApprovals: openRevenueApprovals.map((item) => ({
          id: item.id,
          status: item.status,
          title: item.title
        })),
        boundary:
          'Agents can sell the operating plan and prepare proposals. The Executive Chairman must approve payment instructions, conversions, liquidity actions, and reserve movements.'
      },
      null,
      2
    )
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
