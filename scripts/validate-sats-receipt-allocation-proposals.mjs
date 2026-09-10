import {
  assertConfirmedReceipt,
  recordConfirmedReceipt,
  renderReceiptAllocationProposal
} from './lib/sats-receipt-allocation-proposal.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const reserveAddress = 'bc1q7dgqqyfh7gxn2kze874d07w4qcj43v4zptv6kk';
const approvedInvoice = {
  id: 'invoice-approved-audit-1',
  status: 'approved-by-chairman',
  offerId: 'transparency-audit',
  customer: 'Example Protocol',
  usdPrice: '50',
  settlementCurrency: 'BTC',
  paymentAddress: reserveAddress,
  amountSats: '43210',
  quoteSource: 'manual BTC/USD quote',
  quoteCreatedAtUtc: '2026-08-29T00:00:00Z',
  quoteExpiresAtUtc: '2026-08-29T01:00:00Z',
  chairmanApprovalRequired: true,
  approvedBy: 'executive-chairman',
  approvedAtUtc: '2026-08-29T00:05:00Z',
  deliverable: 'One-page public-readiness audit.',
  publicDisclosure: 'No price guarantee, no redemption promise, and no market-support commitment.'
};

const confirmedReceipt = {
  id: 'receipt-example-audit-1',
  invoiceId: approvedInvoice.id,
  status: 'confirmed',
  receivedAtUtc: '2026-08-29T00:30:00Z',
  source: 'SATA transparency audit service',
  currency: 'BTC',
  amount: '0.00043210',
  amountSats: approvedInvoice.amountSats,
  transactionId: '6f'.repeat(32),
  receivedAddress: reserveAddress,
  confirmations: 2,
  chairmanApprovedBy: 'executive-chairman',
  deliverableUrl: 'https://github.com/sata-project-reserve/sata/issues/1'
};

const ledger = {
  project: 'SATA Reserve Token',
  receipts: [confirmedReceipt],
  allocations: []
};

const queue = {
  paymentPolicy: {
    reserveAddress
  },
  invoices: [approvedInvoice]
};

const rendered = renderReceiptAllocationProposal({
  receipt: confirmedReceipt,
  ledger,
  queue,
  generatedAtUtc: '2026-08-29T00:45:00Z'
});
assertIncludes(rendered, 'Confirmed amount: 43210 sats');
assertIncludes(rendered, `Reserve address: ${reserveAddress}`);
assertIncludes(rendered, 'Chairman review required');
assertIncludes(rendered, 'does not authorize custody changes');

const receiptAgent = readFileSync(join('scripts', 'sats-receipt-allocation-agent.mjs'), 'utf8');
if (!/record-confirmed/.test(receiptAgent)) {
  throw new Error('receipt agent must expose record-confirmed command');
}
if (!/recordConfirmedReceiptCommand/.test(receiptAgent)) {
  throw new Error('receipt plan must expose the bounded record-confirmed command template');
}
if (!/confirmChairmanReceiptApproval/.test(receiptAgent)) {
  throw new Error('receipt agent must require chairman receipt approval phrase');
}
if (!/--recordedAtUtc "<recorded-at-utc>"/.test(receiptAgent)) {
  throw new Error('receipt plan must require an explicit recordedAtUtc timestamp');
}

const recordedLedger = recordConfirmedReceipt({
  ledger: { ...ledger, receipts: [] },
  queue,
  receiptId: 'receipt-recorded-audit-1',
  invoiceId: approvedInvoice.id,
  receivedAtUtc: '2026-08-29T00:30:00Z',
  source: 'SATA transparency audit service',
  amount: '0.00043210',
  amountSats: approvedInvoice.amountSats,
  transactionId: '7a'.repeat(32),
  receivedAddress: reserveAddress,
  confirmations: '3',
  deliverableUrl: 'https://github.com/sata-project-reserve/sata/issues/2',
  confirmChairmanReceiptApproval:
    'I am Executive Chairman and approve receipt receipt-recorded-audit-1',
  recordedAtUtc: '2026-08-29T00:40:00Z'
});
if (recordedLedger.receipts.length !== 1) {
  throw new Error('recordConfirmedReceipt must append one confirmed receipt');
}
assertIncludes(recordedLedger.receipts[0].receiptApprovedAtUtc, '2026-08-29T00:40:00.000Z');

const rejectionCases = [
  {
    name: 'unconfirmed status',
    receipt: { ...confirmedReceipt, id: 'receipt-unconfirmed', status: 'pending' },
    expected: /status confirmed/
  },
  {
    name: 'wrong chairman approval',
    receipt: { ...confirmedReceipt, id: 'receipt-wrong-approval', chairmanApprovedBy: 'agent' },
    expected: /executive-chairman approval/
  },
  {
    name: 'wrong address',
    receipt: { ...confirmedReceipt, id: 'receipt-wrong-address', receivedAddress: 'bc1qwrong' },
    expected: /published reserve address/
  },
  {
    name: 'zero confirmations',
    receipt: { ...confirmedReceipt, id: 'receipt-zero-confirmations', confirmations: 0 },
    expected: /at least 1/
  },
  {
    name: 'mismatched amount',
    receipt: { ...confirmedReceipt, id: 'receipt-mismatched-amount', amountSats: '12345' },
    expected: /must match the approved invoice amountSats/
  },
  {
    name: 'unapproved invoice',
    receipt: { ...confirmedReceipt, id: 'receipt-unapproved-invoice' },
    queue: { ...queue, invoices: [{ ...approvedInvoice, status: 'draft' }] },
    expected: /approved-by-chairman/
  },
  {
    name: 'future receipt',
    receipt: { ...confirmedReceipt, id: 'receipt-future', receivedAtUtc: '2026-08-30T00:00:00Z' },
    expected: /cannot be in the future/
  },
  {
    name: 'late receipt',
    receipt: { ...confirmedReceipt, id: 'receipt-late', receivedAtUtc: '2026-08-29T01:01:00Z' },
    generatedAtUtc: '2026-08-29T01:05:00Z',
    expected: /within the approved invoice quote window/
  }
];

for (const testCase of rejectionCases) {
  assertRejects(testCase.name, testCase.expected, () =>
    assertConfirmedReceipt({
      receipt: testCase.receipt,
      ledger: { ...ledger, receipts: [testCase.receipt] },
      queue: testCase.queue ?? queue,
      generatedAtUtc: testCase.generatedAtUtc ?? '2026-08-29T00:45:00Z'
    })
  );
}
assertRejects('missing receipt approval phrase', /exact Executive Chairman receipt approval phrase/i, () =>
  recordConfirmedReceipt({
    ledger: { ...ledger, receipts: [] },
    queue,
    receiptId: 'receipt-no-approval',
    invoiceId: approvedInvoice.id,
    receivedAtUtc: '2026-08-29T00:30:00Z',
    source: 'SATA transparency audit service',
    amount: '0.00043210',
    amountSats: approvedInvoice.amountSats,
    transactionId: '8b'.repeat(32),
    receivedAddress: reserveAddress,
    confirmations: '2',
    deliverableUrl: 'https://github.com/sata-project-reserve/sata/issues/3',
    confirmChairmanReceiptApproval: 'approved'
  })
);
assertRejects('missing receipt recorded timestamp', /recordedAtUtc must be a valid timestamp/i, () =>
  recordConfirmedReceipt({
    ledger: { ...ledger, receipts: [] },
    queue,
    receiptId: 'receipt-no-recorded-at',
    invoiceId: approvedInvoice.id,
    receivedAtUtc: '2026-08-29T00:30:00Z',
    source: 'SATA transparency audit service',
    amount: '0.00043210',
    amountSats: approvedInvoice.amountSats,
    transactionId: '8c'.repeat(32),
    receivedAddress: reserveAddress,
    confirmations: '2',
    deliverableUrl: 'https://github.com/sata-project-reserve/sata/issues/3',
    confirmChairmanReceiptApproval:
      'I am Executive Chairman and approve receipt receipt-no-recorded-at'
  })
);
assertRejects('duplicate receipt record', /already exists/i, () =>
  recordConfirmedReceipt({
    ledger,
    queue,
    receiptId: confirmedReceipt.id,
    invoiceId: approvedInvoice.id,
    receivedAtUtc: '2026-08-29T00:30:00Z',
    source: 'SATA transparency audit service',
    amount: '0.00043210',
    amountSats: approvedInvoice.amountSats,
    transactionId: '9c'.repeat(32),
    receivedAddress: reserveAddress,
    confirmations: '2',
    deliverableUrl: 'https://github.com/sata-project-reserve/sata/issues/4',
    confirmChairmanReceiptApproval: `I am Executive Chairman and approve receipt ${confirmedReceipt.id}`
  })
);

console.log(
  'Sats receipt allocation proposal check passed: only confirmed direct-reserve invoice receipts can render allocation proposals.'
);

function assertIncludes(value, expected) {
  if (!value.includes(expected)) throw new Error(`Expected rendered proposal to include: ${expected}`);
}

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
