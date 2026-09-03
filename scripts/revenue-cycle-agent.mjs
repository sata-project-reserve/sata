import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildRevenueCycleStatus, validateRevenueCycleStatus } from './lib/revenue-cycle-status.mjs';

const [, , command = 'status'] = process.argv;

const paths = {
  report: join('public', 'transparency', 'latest.json'),
  revenuePlan: join('public', 'revenue-operating-plan.json'),
  ledger: join('public', 'sats-generation-ledger.json'),
  invoiceQueue: join('public', 'sats-invoice-queue.json'),
  prospectPipeline: join('public', 'sats-prospect-pipeline.json'),
  outreachPacketQueue: join('public', 'service-outreach-packet-queue.json'),
  paidPromotionLedger: join('public', 'paid-promotion-ledger.json'),
  approvalQueue: join('public', 'executive-approval-queue.json'),
  socialQueue: join('public', 'social-agent-content-queue.json')
};

const inputs = Object.fromEntries(
  await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)]))
);

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
  const status = buildRevenueCycleStatus(inputs);
  validateRevenueCycleStatus(status);
  return status;
}

function printStatus() {
  const status = buildStatus();
  console.log(JSON.stringify(status, null, 2));
}

async function writeStatus() {
  const status = buildStatus();
  await writeFile(join('public', 'revenue-cycle-status.json'), `${JSON.stringify(status, null, 2)}\n`);
  console.log(JSON.stringify({ wrote: 'public/revenue-cycle-status.json', actions: status.actionQueue.length }, null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
