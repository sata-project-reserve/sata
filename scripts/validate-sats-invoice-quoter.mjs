import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildInvoiceQuoteDraft,
  calculateSatsFromUsd,
  finalizeChairmanApprovedInvoice,
  stageInvoiceQuoteForChairmanReview
} from './lib/sats-invoice-quote.mjs';

const queue = JSON.parse(readFileSync(join('public', 'sats-invoice-queue.json'), 'utf8'));
const approvalQueue = {
  project: 'SATA Reserve Token',
  mode: 'executive-chairman-final-approval',
  schemaVersion: 1,
  items: []
};
const quote = buildInvoiceQuoteDraft({
  queue,
  offerId: 'transparency-audit',
  customer: 'Example Proof Token',
  btcUsd: '100000',
  quoteSource: 'Manual test rate',
  createdAtUtc: '2026-08-28T00:00:00.000Z',
  ttlMinutes: 30
});
const findings = [];

if (calculateSatsFromUsd({ usd: '50', btcUsd: '100000' }).toString() !== '50000') {
  findings.push('quote calculator must convert $50 at $100,000/BTC to 50,000 sats');
}
if (quote.status !== 'draft') findings.push('quote output must remain a draft');
if (quote.amountSats !== '50000')
  findings.push('quote amountSats must be exact for the fixture rate');
if (quote.quoteCreatedAtUtc !== '2026-08-28T00:00:00.000Z') {
  findings.push('quoteCreatedAtUtc must preserve the provided ISO timestamp');
}
if (quote.quoteExpiresAtUtc !== '2026-08-28T00:30:00.000Z') {
  findings.push('quoteExpiresAtUtc must apply the ttlMinutes window');
}
if (quote.paymentAddress !== queue.paymentPolicy.reserveAddress) {
  findings.push('quote paymentAddress must match the invoice queue reserve address');
}
if (quote.chairmanApprovalRequired !== true) {
  findings.push('quote must require chairman approval');
}
if (!/Draft quote only/i.test(quote.boundary)) {
  findings.push('quote boundary must state this is a draft only');
}
if (!/payment instruction is sent/i.test(quote.boundary)) {
  findings.push('quote boundary must require approval before payment instructions are sent');
}

const staged = stageInvoiceQuoteForChairmanReview({
  invoiceQueue: {
    ...queue,
    invoices: queue.invoices.filter((invoice) => invoice.id !== quote.id)
  },
  approvalQueue,
  quote,
  evidence: 'Customer invoice request evidence URL',
  createdAtUtc: '2026-08-28T00:00:00.000Z'
});
if (
  !staged.invoiceQueue.invoices.some(
    (invoice) => invoice.id === quote.id && invoice.status === 'draft'
  )
) {
  findings.push('write staging must append a draft invoice only');
}
if (staged.approvalItem.status !== 'ready-for-chairman-review') {
  findings.push('write staging must create a ready-for-chairman-review approval item');
}
if (staged.approvalItem.category !== 'revenue-action') {
  findings.push('invoice approval item must use revenue-action category');
}
if (!/No agent may receive funds/i.test(staged.approvalItem.riskReview.join('\n'))) {
  findings.push('invoice approval item must preserve non-custodial risk control');
}
assertRejects('duplicate invoice staging', /invoice already exists/, () =>
  stageInvoiceQuoteForChairmanReview({
    invoiceQueue: staged.invoiceQueue,
    approvalQueue,
    quote,
    evidence: 'Customer invoice request evidence URL'
  })
);
assertRejects('quote missing createdAtUtc', /createdAtUtc must be a valid date/i, () =>
  buildInvoiceQuoteDraft({
    queue,
    offerId: 'transparency-audit',
    customer: 'Example Proof Token',
    btcUsd: '100000',
    quoteSource: 'Manual test rate'
  })
);
assertRejects('unapproved finalize', /must be approved-by-chairman first/, () =>
  finalizeChairmanApprovedInvoice({
    invoiceQueue: staged.invoiceQueue,
    approvalQueue: staged.approvalQueue,
    invoiceId: quote.id,
    approvedAtUtc: '2026-08-28T00:10:00.000Z'
  })
);
const approvedQueue = {
  ...staged.approvalQueue,
  items: staged.approvalQueue.items.map((item) =>
    item.id === staged.approvalItem.id
      ? {
          ...item,
          status: 'approved-by-chairman',
          approvedBy: 'executive-chairman',
          approvedAtUtc: '2026-08-28T00:05:00.000Z'
        }
      : item
  )
};
const finalizedQueue = finalizeChairmanApprovedInvoice({
  invoiceQueue: staged.invoiceQueue,
  approvalQueue: approvedQueue,
  invoiceId: quote.id,
  approvedAtUtc: '2026-08-28T00:10:00.000Z'
});
const finalized = finalizedQueue.invoices.find((invoice) => invoice.id === quote.id);
if (finalized?.status !== 'approved-by-chairman') {
  findings.push('finalize must mark the invoice approved only after approval item approval');
}
if (finalized?.approvedBy !== 'executive-chairman') {
  findings.push('finalized invoice must record executive-chairman approval');
}
if (finalized?.approvalId !== staged.approvalItem.id) {
  findings.push('finalized invoice must link back to the approval item');
}
assertRejects('finalize missing approvedAtUtc', /approvedAtUtc must be a valid date/i, () =>
  finalizeChairmanApprovedInvoice({
    invoiceQueue: staged.invoiceQueue,
    approvalQueue: approvedQueue,
    invoiceId: quote.id
  })
);

if (findings.length > 0) {
  console.error('Sats invoice quoter check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Sats invoice quoter check passed: manual BTC/USD rates produce draft exact-sats invoices.'
);

function assertRejects(name, expected, fn) {
  try {
    fn();
  } catch (error) {
    if (!expected.test(error.message)) {
      throw new Error(`${name}: expected ${expected}, received ${error.message}`);
    }
    return;
  }
  throw new Error(`${name}: expected rejection.`);
}
