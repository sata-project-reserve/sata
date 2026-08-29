import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderInvoicePaymentPacket } from './lib/sats-invoice-payment-packet.mjs';

const QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const [, , command = 'plan', ...args] = process.argv;
const queue = await readJson(QUEUE_PATH);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'render':
    printPacket(args[0]);
    break;
  default:
    throw new Error(`Unknown invoice payment packet command: ${command}. Use plan or render <invoice-id>.`);
}

function printPlan() {
  const approvedInvoices = (queue.invoices ?? []).filter(
    (invoice) => invoice.status === 'approved-by-chairman'
  );
  console.log(
    JSON.stringify(
      {
        project: queue.project,
        mode: 'approved-invoice-payment-packets',
        reserveAddress: queue.paymentPolicy.reserveAddress,
        approvedInvoiceCount: approvedInvoices.length,
        approvedInvoices: approvedInvoices.map((invoice) => ({
          id: invoice.id,
          customer: invoice.customer,
          amountSats: invoice.amountSats,
          quoteExpiresAtUtc: invoice.quoteExpiresAtUtc
        })),
        nextAction:
          'After the Executive Chairman approves an exact-sats invoice record, render the customer payment packet and send it manually.',
        boundary:
          'The payment packet renderer refuses templates, drafts, unapproved invoices, expired quotes, and payment addresses that differ from the published reserve address.'
      },
      null,
      2
    )
  );
}

function printPacket(invoiceId) {
  if (!invoiceId) throw new Error('Missing invoice id.');
  const invoice = (queue.invoices ?? []).find((item) => item.id === invoiceId);
  if (!invoice) throw new Error(`Invoice not found: ${invoiceId}.`);
  console.log(renderInvoicePaymentPacket({ invoice, queue }));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
