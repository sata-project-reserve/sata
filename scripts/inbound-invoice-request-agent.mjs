import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildInboundInvoiceRequestPacket,
  renderInboundInvoiceRequestPacket
} from './lib/inbound-invoice-request-packet.mjs';

const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const [, , command = 'plan', ...args] = process.argv;
const options = parseOptions(args);
const [inboundQueue, invoiceQueue] = await Promise.all([
  readJson(INBOUND_QUEUE_PATH),
  readJson(INVOICE_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
  case 'json':
    printJsonPlan();
    break;
  case 'render':
    console.log(
      renderInboundInvoiceRequestPacket({
        inboundQueue,
        invoiceQueue,
        leadIds: options.leads ?? options.lead
      })
    );
    break;
  default:
    throw new Error(`Unknown inbound invoice request command: ${command}. Use plan, json, or render.`);
}

function printJsonPlan() {
  const eligible = (inboundQueue.leads ?? [])
    .filter((lead) => lead.status === 'invoice-requested-needs-chairman-review')
    .map((lead) => ({
      id: lead.id,
      contactHandle: lead.contactHandle,
      requestedOfferId: lead.requestedOfferId,
      projectUrl: lead.projectUrl,
      renderCommand: `node scripts/inbound-invoice-request-agent.mjs render --lead ${lead.id}`
    }));

  console.log(
    JSON.stringify(
      {
        project: inboundQueue.project,
        mode: 'inbound-invoice-request-planner',
        eligible,
        blocked: eligible.length === 0,
        nextAction:
          eligible.length === 0
            ? 'Wait for an inbound lead to request an invoice, then record it with customerAskedForInvoice true.'
            : `Render chairman review packet for inbound invoice request ${eligible[0].id}.`,
        boundary:
          'This planner prepares quote inputs only. It does not approve invoices, send payment instructions, start paid work, grant tokens, control custody, or move assets.'
      },
      null,
      2
    )
  );
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
