import {
  assertConfirmedAllocation,
  assertConfirmedReceipt,
  recordConfirmedAllocation,
  recordConfirmedReceipt,
  renderReceiptAllocationProposal
} from './lib/sats-receipt-allocation-proposal.mjs';
import { execFileSync } from 'node:child_process';
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
  receiptApprovedAtUtc: '2026-08-29T00:35:00Z',
  deliverableUrl: 'https://github.com/sata-project-reserve/sata/issues/1'
};
const confirmedAllocation = {
  id: 'allocation-example-audit-1',
  receiptId: confirmedReceipt.id,
  allocatedAtUtc: '2026-08-29T00:40:00Z',
  allocatedTo: 'btcReserve',
  currency: 'BTC',
  amount: confirmedReceipt.amount,
  actualSatsAdded: confirmedReceipt.amountSats,
  transactionId: confirmedReceipt.transactionId,
  transparencyReportUrl: 'https://sata-project-reserve.github.io/sata/transparency'
};

const ledger = {
  project: 'SATA Reserve Token',
  requiredAllocationFields: [
    'id',
    'receiptId',
    'allocatedAtUtc',
    'allocatedTo',
    'currency',
    'amount',
    'actualSatsAdded',
    'transactionId',
    'transparencyReportUrl'
  ],
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
assertConfirmedAllocation({
  allocation: confirmedAllocation,
  ledger: { ...ledger, allocations: [confirmedAllocation] },
  queue,
  generatedAtUtc: '2026-08-29T00:45:00Z'
});

const receiptAgent = readFileSync(join('scripts', 'sats-receipt-allocation-agent.mjs'), 'utf8');
const receiptIssueTemplate = readFileSync(
  join('.github', 'ISSUE_TEMPLATE', 'receipt-evidence.yml'),
  'utf8'
);
if (!/record-confirmed/.test(receiptAgent)) {
  throw new Error('receipt agent must expose record-confirmed command');
}
if (!/render-template/.test(receiptAgent)) {
  throw new Error('receipt agent must expose the render-template helper command');
}
if (!/receipt-evidence\.yml/.test(receiptAgent)) {
  throw new Error('receipt plan must expose the receipt evidence issue template');
}
if (!/renderEvidenceIssueTemplateCommand/.test(receiptAgent)) {
  throw new Error('receipt plan must expose the receipt evidence issue-body command');
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
if (!/record-allocation/.test(receiptAgent)) {
  throw new Error('receipt agent must expose record-allocation command');
}
if (!/recordConfirmedAllocationCommand/.test(receiptAgent)) {
  throw new Error('receipt plan must expose the bounded record-allocation command template');
}
if (!/confirmChairmanAllocationApproval/.test(receiptAgent)) {
  throw new Error('receipt agent must require chairman allocation approval phrase');
}
if (!/--allocatedAtUtc "<allocated-at-utc>"/.test(receiptAgent)) {
  throw new Error('receipt plan must require an explicit allocatedAtUtc timestamp');
}
for (const expected of [
  'BTC Reserve Receipt Evidence',
  'receiptId',
  'invoiceId',
  'receivedAtUtc',
  'bitcoinTransactionId',
  'chairmanReceiptApproval',
  'does not approve invoices'
]) {
  assertIncludes(receiptIssueTemplate, expected);
}
const renderedReceiptTemplate = execFileSync(
  process.execPath,
  [
    'scripts/sats-receipt-allocation-agent.mjs',
    'render-template',
    '--receipt',
    'receipt-recorded-audit-1',
    '--invoice',
    approvedInvoice.id,
    '--receivedAtUtc',
    '2026-08-29T00:30:00Z',
    '--source',
    'SATA transparency audit service',
    '--amount',
    '0.00043210',
    '--amountSats',
    approvedInvoice.amountSats,
    '--transactionId',
    '7a'.repeat(32),
    '--receivedAddress',
    reserveAddress,
    '--confirmations',
    '3',
    '--deliverableUrl',
    'https://github.com/sata-project-reserve/sata/issues/2',
    '--recordedAtUtc',
    '2026-08-29T00:40:00Z'
  ],
  { encoding: 'utf8' }
);
for (const expected of [
  '### Receipt ID',
  'receipt-recorded-audit-1',
  '### Approved invoice ID',
  approvedInvoice.id,
  '### Bitcoin transaction ID',
  '7a'.repeat(32),
  '### Chairman receipt approval phrase',
  'I am Executive Chairman and approve receipt receipt-recorded-audit-1'
]) {
  assertIncludes(renderedReceiptTemplate, expected);
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
const recordedAllocationLedger = recordConfirmedAllocation({
  ledger,
  queue,
  allocationId: 'allocation-recorded-audit-1',
  receiptId: confirmedReceipt.id,
  allocatedAtUtc: '2026-08-29T00:42:00Z',
  transparencyReportUrl: 'https://sata-project-reserve.github.io/sata/transparency',
  confirmChairmanAllocationApproval:
    'I am Executive Chairman and approve allocation allocation-recorded-audit-1'
});
if (recordedAllocationLedger.allocations.length !== 1) {
  throw new Error('recordConfirmedAllocation must append one confirmed allocation');
}
const recordedAllocation = recordedAllocationLedger.allocations[0];
if (recordedAllocation.actualSatsAdded !== confirmedReceipt.amountSats) {
  throw new Error('recordConfirmedAllocation must derive actualSatsAdded from the confirmed receipt');
}
if (recordedAllocation.transactionId !== confirmedReceipt.transactionId) {
  throw new Error('recordConfirmedAllocation must derive transactionId from the confirmed receipt');
}

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
    receipt: { ...confirmedReceipt, id: 'receipt-mismatched-amount', amount: '0.00012345', amountSats: '12345' },
    expected: /must match the approved invoice amountSats/
  },
  {
    name: 'malformed txid',
    receipt: { ...confirmedReceipt, id: 'receipt-malformed-txid', transactionId: 'not-a-txid' },
    expected: /64-character Bitcoin transaction id/
  },
  {
    name: 'btc amount mismatch',
    receipt: { ...confirmedReceipt, id: 'receipt-btc-amount-mismatch', amount: '0.00043211' },
    expected: /BTC amount must match amountSats exactly/
  },
  {
    name: 'btc amount overprecision',
    receipt: { ...confirmedReceipt, id: 'receipt-btc-amount-overprecision', amount: '0.000432100' },
    expected: /at most 8 decimal places/
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
const allocationRejectionCases = [
  {
    name: 'allocation wrong destination',
    allocation: { ...confirmedAllocation, id: 'allocation-wrong-destination', allocatedTo: 'liquidity' },
    expected: /allocatedTo must be btcReserve/
  },
  {
    name: 'allocation sats mismatch',
    allocation: { ...confirmedAllocation, id: 'allocation-sats-mismatch', actualSatsAdded: '1' },
    expected: /actualSatsAdded must match/
  },
  {
    name: 'allocation txid mismatch',
    allocation: { ...confirmedAllocation, id: 'allocation-txid-mismatch', transactionId: '7d'.repeat(32) },
    expected: /transactionId must match/
  },
  {
    name: 'allocation early timestamp',
    allocation: { ...confirmedAllocation, id: 'allocation-early', allocatedAtUtc: '2026-08-29T00:20:00Z' },
    expected: /cannot be before/
  },
  {
    name: 'allocation future timestamp',
    allocation: { ...confirmedAllocation, id: 'allocation-future', allocatedAtUtc: '2026-08-30T00:00:00Z' },
    expected: /cannot be in the future/
  },
  {
    name: 'allocation placeholder transparency report',
    allocation: {
      ...confirmedAllocation,
      id: 'allocation-placeholder-report',
      transparencyReportUrl: 'regenerate after chairman approval'
    },
    expected: /published transparency report URL/
  },
  {
    name: 'allocation duplicate receipt',
    allocation: { ...confirmedAllocation, id: 'allocation-duplicate-receipt' },
    ledger: {
      ...ledger,
      allocations: [confirmedAllocation, { ...confirmedAllocation, id: 'allocation-duplicate-receipt' }]
    },
    expected: /receiptId can only be allocated once/
  }
];
for (const testCase of allocationRejectionCases) {
  assertRejects(testCase.name, testCase.expected, () =>
    assertConfirmedAllocation({
      allocation: testCase.allocation,
      ledger: testCase.ledger ?? { ...ledger, allocations: [testCase.allocation] },
      queue,
      generatedAtUtc: '2026-08-29T00:45:00Z'
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
assertRejects('missing allocation approval phrase', /exact Executive Chairman allocation approval phrase/i, () =>
  recordConfirmedAllocation({
    ledger,
    queue,
    allocationId: 'allocation-no-approval',
    receiptId: confirmedReceipt.id,
    allocatedAtUtc: '2026-08-29T00:42:00Z',
    transparencyReportUrl: 'https://sata-project-reserve.github.io/sata/transparency',
    confirmChairmanAllocationApproval: 'approved'
  })
);
assertRejects('duplicate allocation record', /allocation already exists/i, () =>
  recordConfirmedAllocation({
    ledger: { ...ledger, allocations: [confirmedAllocation] },
    queue,
    allocationId: confirmedAllocation.id,
    receiptId: confirmedReceipt.id,
    allocatedAtUtc: '2026-08-29T00:42:00Z',
    transparencyReportUrl: 'https://sata-project-reserve.github.io/sata/transparency',
    confirmChairmanAllocationApproval: `I am Executive Chairman and approve allocation ${confirmedAllocation.id}`
  })
);
assertRejects('duplicate receipt allocation record', /receipt already has an allocation record/i, () =>
  recordConfirmedAllocation({
    ledger: { ...ledger, allocations: [confirmedAllocation] },
    queue,
    allocationId: 'allocation-second-for-receipt',
    receiptId: confirmedReceipt.id,
    allocatedAtUtc: '2026-08-29T00:42:00Z',
    transparencyReportUrl: 'https://sata-project-reserve.github.io/sata/transparency',
    confirmChairmanAllocationApproval:
      'I am Executive Chairman and approve allocation allocation-second-for-receipt'
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
