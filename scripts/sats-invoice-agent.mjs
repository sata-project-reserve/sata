import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const LEDGER_PATH = join('public', 'sats-generation-ledger.json');
const REPORT_PATH = join('public', 'transparency', 'latest.json');

const [, , command = 'plan'] = process.argv;
const [queue, ledger, report] = await Promise.all([
  readJson(QUEUE_PATH),
  readJson(LEDGER_PATH),
  readJson(REPORT_PATH)
]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  default:
    throw new Error(`Unknown sats invoice command: ${command}. Use plan.`);
}

function printPlan() {
  const templates = (queue.invoices ?? []).filter((invoice) => invoice.status === 'template');
  const openInvoices = (queue.invoices ?? []).filter((invoice) =>
    ['draft', 'approved-by-chairman', 'sent', 'paid-unconfirmed'].includes(invoice.status)
  );

  console.log(
    JSON.stringify(
      {
        project: queue.project,
        mode: queue.mode,
        reserveAddress: queue.paymentPolicy.reserveAddress,
        currentReserveSats: report.bitcoinReserve.reserveSats,
        remainingSats: ledger.target.remainingSats,
        templates: templates.map((invoice) => ({
          id: invoice.id,
          offerId: invoice.offerId,
          usdPrice: invoice.usdPrice,
          settlementCurrency: invoice.settlementCurrency,
          paymentAddress: invoice.paymentAddress,
          quoteRule: queue.paymentPolicy.quoteRule
        })),
        openInvoices: openInvoices.map((invoice) => ({
          id: invoice.id,
          status: invoice.status,
          customer: invoice.customer,
          amountSats: invoice.amountSats
        })),
        nextAction:
          'For a qualified buyer, create a chairman-approved invoice with exact sats, quote source, quote timestamp, expiration, and the public reserve payment address.',
        boundary:
          'Agents can prepare invoice records. The Executive Chairman approves quote amounts and payment instructions; customers pay the published reserve address directly.'
      },
      null,
      2
    )
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
