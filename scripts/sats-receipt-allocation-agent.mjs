import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
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
  case 'render':
    renderReceipt(args[0]);
    break;
  case 'record-confirmed':
    await writeConfirmedReceipt(parseOptions(args));
    break;
  default:
    throw new Error(
      `Unknown receipt allocation command: ${command}. Use plan, render <receipt-id>, or record-confirmed.`
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
        recordConfirmedReceiptCommand:
          'node scripts/sats-receipt-allocation-agent.mjs record-confirmed --receipt "<receipt-id>" --invoice "<approved-invoice-id>" --receivedAtUtc "<received-at-utc>" --source "<service-source>" --amount "<btc-amount>" --amountSats "<exact-sats>" --transactionId "<bitcoin-txid>" --receivedAddress "<published-reserve-address>" --confirmations "<confirmations>" --deliverableUrl "<delivery-evidence-url>" --recordedAtUtc "<recorded-at-utc>" --confirmChairmanReceiptApproval "I am Executive Chairman and approve receipt <receipt-id>"',
        boundary:
          'This agent renders allocation proposals and records chairman-approved receipt evidence only. It cannot verify private keys, move BTC, spend SOL/SATA, or approve ledger updates.'
      },
      null,
      2
    )
  );
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
