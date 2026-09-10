export function renderReceiptAllocationProposal({ receipt, ledger, queue, generatedAtUtc = new Date().toISOString() }) {
  const { invoice } = assertConfirmedReceipt({ receipt, ledger, queue, generatedAtUtc });

  return [
    `SATA Reserve Receipt Allocation Proposal - ${receipt.id}`,
    '',
    `Generated: ${generatedAtUtc}`,
    `Receipt source: ${receipt.source}`,
    `Invoice: ${invoice.id}`,
    `Customer: ${invoice.customer}`,
    `Deliverable: ${receipt.deliverableUrl}`,
    '',
    `Confirmed amount: ${receipt.amountSats} sats`,
    `Payment currency: ${receipt.currency}`,
    `Reserve address: ${receipt.receivedAddress}`,
    `Bitcoin transaction id: ${receipt.transactionId}`,
    `Confirmations: ${receipt.confirmations}`,
    '',
    'Proposed ledger allocation:',
    `- allocatedTo: btcReserve`,
    `- actualSatsAdded: ${receipt.amountSats}`,
    `- transactionId: ${receipt.transactionId}`,
    '- transparencyReportUrl: regenerate after chairman approval',
    '',
    'Chairman review required:',
    '- Confirm the transaction independently before merging the receipt/allocation record.',
    '- Regenerate the transparency report after the ledger is updated.',
    '- Do not treat this as spendable operating revenue; the payment was sent directly to the published BTC reserve address.',
    '',
    'Boundary:',
    'This proposal records a confirmed direct-reserve receipt. It does not authorize custody changes, reserve movement, market support, or any new payment instruction.'
  ].join('\n');
}

export function recordConfirmedReceipt({
  ledger,
  queue,
  receiptId,
  invoiceId,
  receivedAtUtc,
  source,
  currency = 'BTC',
  amount,
  amountSats,
  transactionId,
  receivedAddress,
  confirmations,
  deliverableUrl,
  confirmChairmanReceiptApproval,
  recordedAtUtc
}) {
  if (!ledger) throw new Error('Missing sats generation ledger.');
  if (!queue) throw new Error('Missing invoice queue.');
  const id = cleanLine(receiptId);
  if (!id) throw new Error('receiptId is required.');
  if ((ledger.receipts ?? []).some((receipt) => receipt.id === id)) {
    throw new Error(`${id}: receipt already exists.`);
  }
  const requiredApproval = `I am Executive Chairman and approve receipt ${id}`;
  if (cleanLine(confirmChairmanReceiptApproval) !== requiredApproval) {
    throw new Error(`${id}: exact Executive Chairman receipt approval phrase is required.`);
  }
  const receipt = {
    id,
    invoiceId: cleanLine(invoiceId),
    status: 'confirmed',
    receivedAtUtc: normalizeTimestamp(receivedAtUtc, 'receivedAtUtc'),
    source: cleanLine(source),
    currency: cleanLine(currency || 'BTC'),
    amount: cleanLine(amount),
    amountSats: cleanLine(amountSats),
    transactionId: cleanLine(transactionId),
    receivedAddress: cleanLine(receivedAddress || queue.paymentPolicy?.reserveAddress),
    confirmations: Number(confirmations),
    chairmanApprovedBy: 'executive-chairman',
    receiptApprovedAtUtc: normalizeTimestamp(recordedAtUtc, 'recordedAtUtc'),
    deliverableUrl: cleanLine(deliverableUrl)
  };
  const nextLedger = {
    ...ledger,
    updatedAtUtc: receipt.receiptApprovedAtUtc,
    receipts: [...(ledger.receipts ?? []), receipt]
  };
  assertConfirmedReceipt({
    receipt,
    ledger: nextLedger,
    queue,
    generatedAtUtc: receipt.receiptApprovedAtUtc
  });
  return nextLedger;
}

export function assertConfirmedReceipt({ receipt, ledger, queue, generatedAtUtc = new Date().toISOString() }) {
  const label = receipt?.id ?? '<missing-receipt>';
  if (!receipt) throw new Error('Missing receipt.');
  if (!ledger) throw new Error('Missing sats generation ledger.');
  if (!queue) throw new Error('Missing invoice queue.');
  if (receipt.status !== 'confirmed') {
    throw new Error(`${label}: allocation proposals require status confirmed.`);
  }
  if (receipt.chairmanApprovedBy !== 'executive-chairman') {
    throw new Error(`${label}: receipt must retain executive-chairman approval.`);
  }
  for (const field of [
    'id',
    'invoiceId',
    'receivedAtUtc',
    'source',
    'currency',
    'amount',
    'amountSats',
    'transactionId',
    'receivedAddress',
    'deliverableUrl'
  ]) {
    if (!receipt[field] || typeof receipt[field] !== 'string') {
      throw new Error(`${label}: missing receipt field ${field}.`);
    }
  }

  if (receipt.currency !== 'BTC') {
    throw new Error(`${label}: only direct BTC reserve receipts can become reserve allocation proposals.`);
  }
  if (!/^\d+$/.test(receipt.amountSats) || BigInt(receipt.amountSats) <= 0n) {
    throw new Error(`${label}: amountSats must be a positive integer string.`);
  }
  if (!Number.isInteger(receipt.confirmations) || receipt.confirmations < 1) {
    throw new Error(`${label}: confirmations must be an integer of at least 1.`);
  }
  if (receipt.receivedAddress !== queue.paymentPolicy?.reserveAddress) {
    throw new Error(`${label}: receivedAddress must match the published reserve address.`);
  }
  if (/placeholder|to-be-filled|quote-required/i.test(receipt.transactionId)) {
    throw new Error(`${label}: transactionId must be the real Bitcoin transaction id.`);
  }

  const invoice = (queue.invoices ?? []).find((candidate) => candidate.id === receipt.invoiceId);
  if (!invoice) throw new Error(`${label}: invoiceId does not match an invoice queue entry.`);
  if (invoice.status !== 'approved-by-chairman') {
    throw new Error(`${label}: linked invoice must be approved-by-chairman.`);
  }
  if (invoice.paymentAddress !== receipt.receivedAddress) {
    throw new Error(`${label}: linked invoice payment address must match receivedAddress.`);
  }
  if (invoice.amountSats !== receipt.amountSats) {
    throw new Error(`${label}: receipt amountSats must match the approved invoice amountSats.`);
  }

  const receivedAt = toTime(receipt.receivedAtUtc, 'receivedAtUtc');
  const generatedAt = toTime(generatedAtUtc, 'generatedAtUtc');
  if (receivedAt > generatedAt) throw new Error(`${label}: receivedAtUtc cannot be in the future.`);
  if (invoice.quoteExpiresAtUtc && receivedAt > toTime(invoice.quoteExpiresAtUtc, 'quoteExpiresAtUtc')) {
    throw new Error(`${label}: receivedAtUtc must be within the approved invoice quote window.`);
  }

  const duplicateReceipt = (ledger.receipts ?? []).filter((candidate) => candidate.id === receipt.id).length > 1;
  if (duplicateReceipt) throw new Error(`${label}: receipt id must be unique.`);

  return { invoice };
}

function toTime(value, label) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new Error(`${label} must be a valid timestamp.`);
  return time;
}

function normalizeTimestamp(value, label) {
  return new Date(toTime(value, label)).toISOString();
}

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
