import { join } from 'node:path';
import {
  buildRevenueCyclePublicStatus,
  readRevenueCyclePublicInputs,
  REVENUE_CYCLE_PUBLIC_PATHS,
  writeRevenueCyclePublicStatus
} from './lib/revenue-cycle-public-state.mjs';

const [, , command = 'status'] = process.argv;

const inputs = await readRevenueCyclePublicInputs();

switch (command) {
  case 'status':
  case 'plan':
    printStatus();
    break;
  case 'write':
    await writeStatus();
    break;
  default:
    throw new Error(`Unknown revenue-cycle command: ${command}. Use status or write.`);
}

function buildStatus() {
  return buildRevenueCyclePublicStatus(inputs);
}

function printStatus() {
  const status = buildStatus();
  console.log(JSON.stringify(status, null, 2));
}

async function writeStatus() {
  const status = await writeRevenueCyclePublicStatus({
    paths: REVENUE_CYCLE_PUBLIC_PATHS,
    statusPath: join('public', 'revenue-cycle-status.json')
  });
  console.log(
    JSON.stringify(
      {
        wrote: [
          'public/revenue-cycle-status.json',
          'public/revenue-execution-brief.json',
          'public/revenue-execution-brief.md',
          'public/outreach-dispatch-brief.json',
          'public/outreach-dispatch-brief.md',
          'public/reply-conversion-brief.json',
          'public/reply-conversion-brief.md',
          'public/referral-handoff-dispatch-brief.json',
          'public/referral-handoff-dispatch-brief.md'
        ],
        actions: status.actionQueue.length
      },
      null,
      2
    )
  );
}
