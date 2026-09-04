import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildInboundLeadPlan,
  recordInboundLead
} from './lib/inbound-service-leads.mjs';

const QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');
const PAID_PROMOTION_PATH = join('public', 'paid-promotion-ledger.json');
const SOCIAL_QUEUE_PATH = join('public', 'social-agent-content-queue.json');
const [, , command = 'plan', ...args] = process.argv;
const options = parseOptions(args);
const [queue, paidPromotionLedger, socialQueue] = await Promise.all([
  readJson(QUEUE_PATH),
  readJson(PAID_PROMOTION_PATH),
  readJson(SOCIAL_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
  case 'json':
    console.log(JSON.stringify(buildInboundLeadPlan({ queue, paidPromotionLedger, socialQueue }), null, 2));
    break;
  case 'record-lead':
    await writeQueue(
      recordInboundLead({
        queue,
        leadId: options.lead,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        contactHandle: options.contactHandle,
        publicProfileUrl: options.publicProfileUrl,
        projectUrl: options.projectUrl,
        requestedOfferId: options.offer,
        evidence: options.evidence,
        customerAskedForInvoice: /^true$/i.test(options.customerAskedForInvoice ?? ''),
        notes: options.notes
      })
    );
    break;
  default:
    throw new Error(`Unknown inbound lead command: ${command}. Use plan, json, or record-lead.`);
}

async function writeQueue(nextQueue) {
  await writeFile(QUEUE_PATH, `${JSON.stringify(nextQueue, null, 2)}\n`);
  console.log(JSON.stringify(buildInboundLeadPlan({ queue: nextQueue, paidPromotionLedger, socialQueue }), null, 2));
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}`);
    parsed[key.slice(2)] = collected.join(' ');
  }
  return parsed;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
