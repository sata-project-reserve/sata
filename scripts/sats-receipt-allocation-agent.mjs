import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  recordConfirmedAllocation,
  recordConfirmedReceipt,
  renderReceiptAllocationProposal
} from './lib/sats-receipt-allocation-proposal.mjs';
import { writeRevenueCyclePublicStatus } from './lib/revenue-cycle-public-state.mjs';

const LEDGER_PATH = join('public', 'sats-generation-ledger.json');
const QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const [, , command = 'plan', ...args] = process.argv;

const [ledger, queue] = await Promise.all([readJson(LEDGER_PATH), readJson(QUEUE_PATH)]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'render-template':
    printReceiptEvidenceTemplate(args);
    break;
  case 'render':
    renderReceipt(args[0]);
    break;
  case 'record-confirmed':
    await writeConfirmedReceipt(parseOptions(args));
    break;
  case 'record-allocation':
    await writeConfirmedAllocation(parseOptions(args));
    break;
  default:
    throw new Error(
      `Unknown receipt allocation command: ${command}. Use plan, render-template, render <receipt-id>, record-confirmed, or record-allocation.`
    );
}

function printPlan() {
  const receipts = ledger.receipts ?? [];
  const confirmedReceipts = receipts.filter((receipt) => receipt.status === 'confirmed');
  const allocationReceiptIds = new Set((ledger.allocations ?? []).map((allocation) => allocation.receiptId));
  const pendingAllocation = confirmedReceipts.filter((receipt) => !allocationReceiptIds.has(receipt.id));

  console.log(
    JSON.stringify(
      {
        project: ledger.project,
        mode: 'confirmed-receipt-allocation-proposals',
        reserveAddress: queue.paymentPolicy?.reserveAddress,
        confirmedReceiptCount: confirmedReceipts.length,
        pendingAllocationCount: pendingAllocation.length,
        pendingAllocation: pendingAllocation.map((receipt) => ({
          id: receipt.id,
          invoiceId: receipt.invoiceId,
          source: receipt.source,
          amountSats: receipt.amountSats,
          transactionId: receipt.transactionId,
          confirmations: receipt.confirmations
        })),
        nextAction:
          pendingAllocation[0]?.id ?
            `Run node scripts/sats-receipt-allocation-agent.mjs render ${pendingAllocation[0].id} for chairman review.`
          : 'Wait for a confirmed direct-reserve BTC receipt that matches a chairman-approved invoice.',
        evidenceIssueTemplate: '.github/ISSUE_TEMPLATE/receipt-evidence.yml',
        evidenceIssueTemplateUrl:
          'https://github.com/sata-project-reserve/sata/issues/new?template=receipt-evidence.yml',
        renderEvidenceIssueTemplateCommand:
          'node scripts/sats-receipt-allocation-agent.mjs render-template --receipt "<receipt-id>" --invoice "<approved-invoice-id>" --receivedAtUtc "<received-at-utc>" --source "<service-source>" --amount "<btc-amount>" --amountSats "<exact-sats>" --transactionId "<bitcoin-txid>" --receivedAddress "<published-reserve-address>" --confirmations "<confirmations>" --deliverableUrl "<delivery-evidence-url>" --recordedAtUtc "<recorded-at-utc>"',
        recordConfirmedReceiptCommand:
          'node scripts/sats-receipt-allocation-agent.mjs record-confirmed --receipt "<receipt-id>" --invoice "<approved-invoice-id>" --receivedAtUtc "<received-at-utc>" --source "<service-source>" --amount "<btc-amount>" --amountSats "<exact-sats>" --transactionId "<bitcoin-txid>" --receivedAddress "<published-reserve-address>" --confirmations "<confirmations>" --deliverableUrl "<delivery-evidence-url>" --recordedAtUtc "<recorded-at-utc>" --confirmChairmanReceiptApproval "I am Executive Chairman and approve receipt <receipt-id>"',
        recordConfirmedAllocationCommand:
          'node scripts/sats-receipt-allocation-agent.mjs record-allocation --allocation "<allocation-id>" --receipt "<confirmed-receipt-id>" --allocatedAtUtc "<allocated-at-utc>" --transparencyReportUrl "<published-transparency-report-url>" --confirmChairmanAllocationApproval "I am Executive Chairman and approve allocation <allocation-id>"',
        boundary:
          'This agent renders allocation proposals and records chairman-approved receipt/allocation evidence only. It cannot verify private keys, move BTC, spend SOL/SATA, or approve ledger updates.'
      },
      null,
      2
    )
  );
}

function printReceiptEvidenceTemplate(args) {
  console.log(renderReceiptEvidenceIssueBody(parseOptions(args)));
}

export function renderReceiptEvidenceIssueBody({
  receipt = '<receipt-id>',
  invoice = '<approved-invoice-id>',
  receivedAtUtc = '<received-at-utc>',
  source = '<service-source>',
  amount = '<btc-amount>',
  amountSats = '<exact-sats>',
  transactionId = '<bitcoin-txid>',
  receivedAddress = '<published-reserve-address>',
  confirmations = '<confirmations>',
  deliverableUrl = '<delivery-evidence-url>',
  recordedAtUtc = '<recorded-at-utc>'
} = {}) {
  return [
    '### Receipt ID',
    cleanLine(receipt),
    '',
    '### Approved invoice ID',
    cleanLine(invoice),
    '',
    '### Received at UTC',
    cleanLine(receivedAtUtc),
    '',
    '### Service source',
    cleanLine(source),
    '',
    '### BTC amount',
    cleanLine(amount),
    '',
    '### Exact sats',
    cleanLine(amountSats),
    '',
    '### Bitcoin transaction ID',
    cleanLine(transactionId),
    '',
    '### Received BTC address',
    cleanLine(receivedAddress),
    '',
    '### Confirmations',
    cleanLine(confirmations),
    '',
    '### Deliverable evidence URL',
    cleanLine(deliverableUrl),
    '',
    '### Recorded at UTC',
    cleanLine(recordedAtUtc),
    '',
    '### Chairman receipt approval phrase',
    `I am Executive Chairman and approve receipt ${cleanLine(receipt)}`
  ].join('\n');
}

function renderReceipt(id) {
  if (!id) throw new Error('render requires a receipt id.');
  const receipt = (ledger.receipts ?? []).find((candidate) => candidate.id === id);
  if (!receipt) throw new Error(`Receipt not found: ${id}`);
  console.log(renderReceiptAllocationProposal({ receipt, ledger, queue }));
}

async function writeConfirmedReceipt(options) {
  const nextLedger = recordConfirmedReceipt({
    ledger,
    queue,
    receiptId: options.receipt,
    invoiceId: options.invoice,
    receivedAtUtc: options.receivedAtUtc,
    source: options.source,
    amount: options.amount,
    amountSats: options.amountSats,
    transactionId: options.transactionId,
    receivedAddress: options.receivedAddress,
    confirmations: options.confirmations,
    deliverableUrl: options.deliverableUrl,
    confirmChairmanReceiptApproval: options.confirmChairmanReceiptApproval,
    recordedAtUtc: options.recordedAtUtc
  });
  await writeFile(LEDGER_PATH, `${JSON.stringify(nextLedger, null, 2)}\n`);
  await writeRevenueCyclePublicStatus();
  console.log(JSON.stringify({ wrote: LEDGER_PATH, receipts: nextLedger.receipts.length }, null, 2));
}

async function writeConfirmedAllocation(options) {
  const nextLedger = recordConfirmedAllocation({
    ledger,
    queue,
    allocationId: options.allocation,
    receiptId: options.receipt,
    allocatedAtUtc: options.allocatedAtUtc,
    transparencyReportUrl: options.transparencyReportUrl,
    confirmChairmanAllocationApproval: options.confirmChairmanAllocationApproval
  });
  await writeFile(LEDGER_PATH, `${JSON.stringify(nextLedger, null, 2)}\n`);
  await writeRevenueCyclePublicStatus();
  console.log(JSON.stringify({ wrote: LEDGER_PATH, allocations: nextLedger.allocations.length }, null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}`);
    parsed[key.slice(2)] = collected.join(' ');
  }
  return parsed;
}

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
