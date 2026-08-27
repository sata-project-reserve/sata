import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const LEDGER_PATH = join('public', 'sats-generation-ledger.json');
const REPORT_PATH = join('public', 'transparency', 'latest.json');
const REVENUE_PLAN_PATH = join('public', 'revenue-operating-plan.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const PROSPECT_PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');

const [, , command = 'plan'] = process.argv;
const [ledger, report, revenuePlan, invoiceQueue, prospectPipeline] = await Promise.all([
  readJson(LEDGER_PATH),
  readJson(REPORT_PATH),
  readJson(REVENUE_PLAN_PATH),
  readJson(INVOICE_QUEUE_PATH),
  readJson(PROSPECT_PIPELINE_PATH)
]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  default:
    throw new Error(`Unknown sats-generation command: ${command}. Use plan.`);
}

function printPlan() {
  const currentSats = BigInt(report.bitcoinReserve?.reserveSats ?? ledger.target.currentReserveSats);
  const targetSats = BigInt(ledger.target.targetSats);
  const remainingSats = targetSats > currentSats ? targetSats - currentSats : 0n;
  const receipts = ledger.receipts ?? [];
  const allocations = ledger.allocations ?? [];
  const prospects = prospectPipeline.prospects ?? [];
  const openPipeline = (ledger.pipeline ?? []).filter((item) =>
    ['approved-for-outreach', 'qualified-only', 'proposal-sent'].includes(item.stage)
  );
  const nextPipelineItem = openPipeline[0] ?? null;

  console.log(
    JSON.stringify(
      {
        project: ledger.project,
        primaryMetric: ledger.unitEconomics.primaryMetric,
        current: {
          reserveSats: currentSats.toString(),
          reserveBtc: formatSatsAsBtc(currentSats),
          remainingSats: remainingSats.toString(),
          remainingBtc: formatSatsAsBtc(remainingSats),
          transparencyStatus: report.status,
          transparencyGeneratedAtUtc: report.generatedAtUtc
        },
        cycle: revenuePlan.nextCycle,
        pipeline: openPipeline.map((item) => ({
          id: item.id,
          stage: item.stage,
          offerId: item.offerId,
          targetRevenueUsd: item.targetRevenueUsd,
          nextAction: item.nextAction
        })),
        nextAction: nextPipelineItem?.nextAction ?? ledger.nextOperatingAction,
        prospectNextAction: prospectPipeline.nextOperatingAction,
        activeProspects: prospects.length,
        receiptsAwaitingAllocation: receipts.filter((receipt) => !receipt.allocatedAtUtc).length,
        recordedAllocations: allocations.length,
        invoiceTemplates: (invoiceQueue.invoices ?? [])
          .filter((invoice) => invoice.status === 'template')
          .map((invoice) => ({
            id: invoice.id,
            offerId: invoice.offerId,
            usdPrice: invoice.usdPrice,
            settlementCurrency: invoice.settlementCurrency,
            paymentAddress: invoice.paymentAddress
          })),
        boundary:
          'The agent can create pipeline and evidence records. The Executive Chairman must approve payment instructions, conversions, and any BTC reserve movement.'
      },
      null,
      2
    )
  );
}

function formatSatsAsBtc(sats) {
  const whole = sats / 100_000_000n;
  const fraction = (sats % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
