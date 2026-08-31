import { readFile } from 'node:fs/promises';
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
  default:
    throw new Error(`Unknown revenue-cycle command: ${command}. Use status.`);
}

function printStatus() {
  const status = buildRevenueCycleStatus(inputs);
  validateRevenueCycleStatus(status);
  console.log(JSON.stringify(status, null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
