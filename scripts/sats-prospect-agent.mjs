import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const LEDGER_PATH = join('public', 'sats-generation-ledger.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');

const [, , command = 'plan'] = process.argv;
const [pipeline, ledger, invoiceQueue] = await Promise.all([
  readJson(PIPELINE_PATH),
  readJson(LEDGER_PATH),
  readJson(INVOICE_QUEUE_PATH)
]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  default:
    throw new Error(`Unknown sats-prospect command: ${command}. Use plan.`);
}

function printPlan() {
  const prospects = pipeline.prospects ?? [];
  const stages = pipeline.leadStages ?? [];
  const stageCounts = Object.fromEntries(stages.map((stage) => [stage, 0]));
  for (const prospect of prospects) {
    stageCounts[prospect.stage] = (stageCounts[prospect.stage] ?? 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        project: pipeline.project,
        mode: pipeline.mode,
        activeCycleId: pipeline.activeCycleId,
        reserveTargetSats: pipeline.target.reserveTargetSats,
        prospectIntakeUrl: pipeline.prospectIntakeUrl,
        currentReserveSats: ledger.target.currentReserveSats,
        firstClosedDealUsd: pipeline.target.firstClosedDealUsd,
        cycleClosedRevenueUsd: pipeline.target.cycleClosedRevenueUsd,
        dailyCadence: pipeline.dailyCadence,
        idealCustomerProfile: pipeline.idealCustomerProfile.map((profile) => ({
          id: profile.id,
          bestOfferId: profile.bestOfferId,
          qualificationSignals: profile.qualificationSignals
        })),
        stageCounts,
        approvedTemplates: pipeline.approvedOutreachTemplates.map((template) => ({
          id: template.id,
          offerId: template.offerId,
          channel: template.channel
        })),
        invoiceTemplates: invoiceQueue.invoices
          .filter((invoice) => invoice.status === 'template')
          .map((invoice) => ({
            id: invoice.id,
            offerId: invoice.offerId,
            usdPrice: invoice.usdPrice,
            settlementCurrency: invoice.settlementCurrency
          })),
        nextOperatingAction: pipeline.nextOperatingAction,
        boundary:
          'Agents can identify and qualify prospects from public evidence. The Executive Chairman approves outreach, invoices, payment addresses, and any asset allocation.'
      },
      null,
      2
    )
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
