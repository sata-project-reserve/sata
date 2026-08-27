import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const KIT_PATH = join('public', 'transparency-audit-delivery-kit.json');
const PROSPECT_PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');

const [, , command = 'plan'] = process.argv;
const [kit, prospectPipeline, invoiceQueue] = await Promise.all([
  readJson(KIT_PATH),
  readJson(PROSPECT_PIPELINE_PATH),
  readJson(INVOICE_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  default:
    throw new Error(`Unknown transparency-audit-delivery command: ${command}. Use plan.`);
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        project: kit.project,
        mode: kit.mode,
        primaryOfferId: kit.primaryOfferId,
        priceUsd: kit.priceUsd,
        intakeFields: kit.requiredClientIntake,
        deliveryCadence: kit.deliveryCadence,
        deliverableSections: kit.deliverableTemplate.sections,
        invoiceTemplates: invoiceQueue.invoices
          .filter((invoice) => invoice.offerId === kit.primaryOfferId)
          .map((invoice) => ({
            id: invoice.id,
            status: invoice.status,
            settlementCurrency: invoice.settlementCurrency
          })),
        prospectStages: prospectPipeline.leadStages,
        nextOperatingAction: kit.nextOperatingAction,
        boundary:
          'Agents can draft audit artifacts from approved intake and public evidence. The Executive Chairman approves the prospect, invoice, final scope, and any public client attribution.'
      },
      null,
      2
    )
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
