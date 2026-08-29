export function renderInvoicePaymentPacket({ invoice, queue, generatedAtUtc = new Date().toISOString() }) {
  assertApprovedInvoice({ invoice, queue, generatedAtUtc });

  return [
    `SATA Transparency Audit Invoice - ${invoice.customer}`,
    '',
    `Offer: ${invoice.offerId}`,
    `Deliverable: ${invoice.deliverable}`,
    `Price: $${invoice.usdPrice}, payable as exactly ${invoice.amountSats} sats`,
    `Payment address: ${invoice.paymentAddress}`,
    '',
    `Quote source: ${invoice.quoteSource}`,
    `Quote created: ${invoice.quoteCreatedAtUtc}`,
    `Quote expires: ${invoice.quoteExpiresAtUtc}`,
    '',
    'Payment instructions:',
    `- Send exactly ${invoice.amountSats} sats to the address above before the quote expires.`,
    '- Send the transaction id after broadcast.',
    '- Delivery starts after Bitcoin payment confirmation or chairman-approved escrow terms.',
    '',
    'Disclosure:',
    invoice.publicDisclosure,
    '',
    'This invoice was approved by the SATA Executive Chairman before being sent.',
    'SATA agents do not receive funds, hold keys, or redirect payment away from the published reserve address.'
  ].join('\n');
}

export function assertApprovedInvoice({ invoice, queue, generatedAtUtc = new Date().toISOString() }) {
  const label = invoice?.id ?? '<missing-invoice>';
  if (!invoice) throw new Error('Missing invoice.');
  if (!queue) throw new Error('Missing invoice queue.');
  if (invoice.status !== 'approved-by-chairman') {
    throw new Error(`${label}: customer payment packets require status approved-by-chairman.`);
  }
  if (invoice.chairmanApprovalRequired !== true) {
    throw new Error(`${label}: chairmanApprovalRequired must remain true.`);
  }
  if (invoice.approvedBy !== 'executive-chairman' || !invoice.approvedAtUtc) {
    throw new Error(`${label}: approved invoices require approvedBy executive-chairman and approvedAtUtc.`);
  }
  for (const field of [
    'customer',
    'offerId',
    'usdPrice',
    'paymentAddress',
    'amountSats',
    'quoteSource',
    'quoteCreatedAtUtc',
    'quoteExpiresAtUtc',
    'deliverable',
    'publicDisclosure'
  ]) {
    if (!invoice[field] || typeof invoice[field] !== 'string') {
      throw new Error(`${label}: missing invoice field ${field}.`);
    }
  }
  if (invoice.paymentAddress !== queue.paymentPolicy?.reserveAddress) {
    throw new Error(`${label}: payment address must match the published reserve address.`);
  }
  if (!/^\d+$/.test(invoice.amountSats) || BigInt(invoice.amountSats) <= 0n) {
    throw new Error(`${label}: amountSats must be a positive integer string.`);
  }
  for (const [field, value] of [
    ['amountSats', invoice.amountSats],
    ['quoteSource', invoice.quoteSource],
    ['quoteCreatedAtUtc', invoice.quoteCreatedAtUtc],
    ['quoteExpiresAtUtc', invoice.quoteExpiresAtUtc]
  ]) {
    if (/quote-required-before-sending/i.test(value)) {
      throw new Error(`${label}: ${field} must be completed before payment packet rendering.`);
    }
  }

  const generated = toTime(generatedAtUtc, 'generatedAtUtc');
  const created = toTime(invoice.quoteCreatedAtUtc, 'quoteCreatedAtUtc');
  const expires = toTime(invoice.quoteExpiresAtUtc, 'quoteExpiresAtUtc');
  if (expires <= created) throw new Error(`${label}: quote must expire after it is created.`);
  if (generated >= expires) throw new Error(`${label}: quote is expired and must not be sent.`);
  if (!/No price guarantee/i.test(invoice.publicDisclosure)) {
    throw new Error(`${label}: publicDisclosure must include no-price-guarantee language.`);
  }

  return true;
}

function toTime(value, label) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new Error(`${label} must be a valid timestamp.`);
  return time;
}
