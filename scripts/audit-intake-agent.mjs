import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAuditIntakeDraft } from './lib/audit-intake-parser.mjs';

const DELIVERY_KIT_PATH = join('public', 'transparency-audit-delivery-kit.json');
const PROSPECT_PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');

const [, , command = 'plan', ...args] = process.argv;
const [deliveryKit, prospectPipeline, invoiceQueue] = await Promise.all([
  readJson(DELIVERY_KIT_PATH),
  readJson(PROSPECT_PIPELINE_PATH),
  readJson(INVOICE_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'draft-from-issue-json':
    await draftFromIssueJson(args[0]);
    break;
  default:
    throw new Error(`Unknown audit-intake command: ${command}. Use plan or draft-from-issue-json <path>.`);
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        project: deliveryKit.project,
        mode: 'audit-intake-importer',
        intakeUrl: deliveryKit.intakeUrl,
        requiredClientIntake: deliveryKit.requiredClientIntake,
        prospectStages: prospectPipeline.leadStages,
        invoicePaymentAddress: invoiceQueue.paymentPolicy.reserveAddress,
        nextOperatingAction:
          'Export a GitHub intake issue as JSON, then run draft-from-issue-json to produce a prospect, invoice, and delivery draft for chairman review.',
        boundary:
          'The importer drafts records only. It does not contact prospects, send invoices, accept funds, or change pipeline state.'
      },
      null,
      2
    )
  );
}

async function draftFromIssueJson(path) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  const draft = buildAuditIntakeDraft({ issue, deliveryKit, prospectPipeline, invoiceQueue });
  console.log(JSON.stringify(draft, null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
