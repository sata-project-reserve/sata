import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderReceiptAllocationProposal } from './lib/sats-receipt-allocation-proposal.mjs';

const LEDGER_PATH = join('public', 'sats-generation-ledger.json');
const QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const [, , command = 'plan', receiptId] = process.argv;

const [ledger, queue] = await Promise.all([readJson(LEDGER_PATH), readJson(QUEUE_PATH)]);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'render':
    renderReceipt(receiptId);
    break;
  default:
    throw new Error(`Unknown receipt allocation command: ${command}. Use plan or render <receipt-id>.`);
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
        boundary:
          'This agent renders recording proposals only. It cannot verify private keys, move BTC, spend SOL/SATA, or approve ledger updates.'
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
