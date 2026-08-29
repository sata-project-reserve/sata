import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildInvoiceRequestPacket,
  renderInvoiceRequestPacket
} from './lib/prospect-invoice-request.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const [, , command = 'plan', ...args] = process.argv;
const [pipeline, invoiceQueue] = await Promise.all([readJson(PIPELINE_PATH), readJson(INVOICE_QUEUE_PATH)]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'draft':
    printDraft(args);
    break;
  case 'render':
    printRender(args);
    break;
  default:
    throw new Error(`Unknown sats-invoice-request command: ${command}. Use plan, draft, or render.`);
}

function printPlan() {
  const eligible = (pipeline.prospects ?? [])
    .filter(
      (prospect) =>
        prospect.stage === 'invoice-requested' && prospect.chairmanApprovedBeforeOutreach === true
    )
    .map((prospect) => ({
      id: prospect.id,
      recommendedOfferId: prospect.recommendedOfferId,
      projectUrl: prospect.projectUrl
    }));
  console.log(
    JSON.stringify(
      {
        project: pipeline.project,
        mode: 'invoice-request-planner',
        eligible,
        blocked: eligible.length === 0,
        nextAction:
          eligible.length === 0
            ? 'Wait for a contacted prospect to request an invoice before preparing an exact-sats quote.'
            : 'Prepare quote inputs, then generate a draft exact-sats invoice for chairman approval.',
        boundary:
          'This planner does not approve invoices, payment instructions, paid work, token grants, custody changes, or asset movement.'
      },
      null,
      2
    )
  );
}

function printDraft(args) {
  const options = parseOptions(args);
  console.log(
    JSON.stringify(
      buildInvoiceRequestPacket({
        pipeline,
        invoiceQueue,
        prospectIds: options.prospects ?? options.prospect
      }),
      null,
      2
    )
  );
}

function printRender(args) {
  const options = parseOptions(args);
  console.log(
    renderInvoiceRequestPacket({
      pipeline,
      invoiceQueue,
      prospectIds: options.prospects ?? options.prospect
    })
  );
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error('Options must be provided as --key value pairs.');
    const value = values[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}.`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
