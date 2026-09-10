const SATS_PER_BTC = 100_000_000n;
const DECIMAL_SCALE = 1_000_000n;

export function buildInvoiceQuoteDraft({
  queue,
  offerId,
  customer,
  btcUsd,
  quoteSource,
  createdAtUtc,
  ttlMinutes = 30
}) {
  if (!queue) throw new Error('Missing invoice queue.');
  if (!offerId) throw new Error('Missing offerId.');
  if (!customer) throw new Error('Missing customer.');
  if (!btcUsd) throw new Error('Missing btcUsd.');
  if (!quoteSource) throw new Error('Missing quoteSource.');

  const template = (queue.invoices ?? []).find(
    (invoice) => invoice.status === 'template' && invoice.offerId === offerId
  );
  if (!template) throw new Error(`No invoice template found for offerId ${offerId}.`);

  const amountSats = calculateSatsFromUsd({
    usd: template.usdPrice,
    btcUsd
  }).toString();
  const quoteCreatedAtUtc = normalizeIsoDate(createdAtUtc, 'createdAtUtc');
  const quoteExpiresAtUtc = addMinutes(quoteCreatedAtUtc, ttlMinutes);

  return {
    id: `invoice-${slugify(customer)}-${offerId}-${quoteCreatedAtUtc.slice(0, 10).replaceAll('-', '')}`,
    status: 'draft',
    offerId,
    customer,
    usdPrice: template.usdPrice,
    settlementCurrency: template.settlementCurrency,
    paymentAddress: queue.paymentPolicy.reserveAddress,
    amountSats,
    quoteSource,
    quoteCreatedAtUtc,
    quoteExpiresAtUtc,
    chairmanApprovalRequired: true,
    deliverable: template.deliverable,
    postPaymentActions: template.postPaymentActions,
    publicDisclosure: template.publicDisclosure,
    boundary:
      'Draft quote only. Executive Chairman approval is required before this invoice or payment instruction is sent.'
  };
}

export function stageInvoiceQuoteForChairmanReview({
  invoiceQueue,
  approvalQueue,
  quote,
  evidence,
  createdAtUtc = quote?.quoteCreatedAtUtc
}) {
  if (!invoiceQueue) throw new Error('Missing invoice queue.');
  if (!approvalQueue) throw new Error('Missing approval queue.');
  assertDraftInvoiceQuote({ invoiceQueue, quote });

  if ((invoiceQueue.invoices ?? []).some((invoice) => invoice.id === quote.id)) {
    throw new Error(`${quote.id}: invoice already exists.`);
  }

  const approvalItem = buildInvoiceQuoteApprovalItem({ quote, evidence, createdAtUtc });
  if ((approvalQueue.items ?? []).some((item) => item.id === approvalItem.id)) {
    throw new Error(`${approvalItem.id}: approval item already exists.`);
  }

  return {
    invoiceQueue: {
      ...invoiceQueue,
      updatedAtUtc: approvalItem.createdAtUtc,
      invoices: [...(invoiceQueue.invoices ?? []), quote]
    },
    approvalQueue: {
      ...approvalQueue,
      updatedAtUtc: approvalItem.createdAtUtc,
      items: [...(approvalQueue.items ?? []), approvalItem]
    },
    approvalItem
  };
}

export function finalizeChairmanApprovedInvoice({
  invoiceQueue,
  approvalQueue,
  invoiceId,
  approvalId = `invoice-approval-${invoiceId}`,
  approvedAtUtc
}) {
  if (!invoiceQueue) throw new Error('Missing invoice queue.');
  if (!approvalQueue) throw new Error('Missing approval queue.');
  if (!invoiceId) throw new Error('Missing invoiceId.');

  const invoice = (invoiceQueue.invoices ?? []).find((item) => item.id === invoiceId);
  if (!invoice) throw new Error(`Invoice not found: ${invoiceId}.`);
  assertDraftInvoiceQuote({ invoiceQueue, quote: invoice });

  const approval = (approvalQueue.items ?? []).find((item) => item.id === approvalId);
  if (!approval) throw new Error(`Approval item not found: ${approvalId}.`);
  if (approval.status !== 'approved-by-chairman') {
    throw new Error(`${approvalId}: approval item must be approved-by-chairman first.`);
  }
  if (!approval.approvedBy || !approval.approvedAtUtc) {
    throw new Error(`${approvalId}: approval item must include chairman approval evidence.`);
  }
  if (!approval.proposedAction?.includes(invoice.id)) {
    throw new Error(`${approvalId}: approval item does not reference invoice ${invoice.id}.`);
  }

  const now = normalizeIsoDate(approvedAtUtc, 'approvedAtUtc');
  const expires = new Date(invoice.quoteExpiresAtUtc).getTime();
  if (new Date(now).getTime() >= expires) {
    throw new Error(`${invoice.id}: quote is expired and cannot be approved.`);
  }

  return {
    ...invoiceQueue,
    updatedAtUtc: now,
    invoices: (invoiceQueue.invoices ?? []).map((item) =>
      item.id === invoice.id
        ? {
            ...item,
            status: 'approved-by-chairman',
            approvedBy: 'executive-chairman',
            approvedAtUtc: now,
            approvalId: approval.id,
            boundary:
              'Executive Chairman approved this exact-sats invoice. Customer payment packets must still be rendered and sent manually before any customer payment.'
          }
        : item
    )
  };
}

export function buildInvoiceQuoteApprovalItem({
  quote,
  evidence,
  createdAtUtc = quote?.quoteCreatedAtUtc
}) {
  assertDraftShape(quote);
  const created = normalizeIsoDate(createdAtUtc, 'createdAtUtc');
  const evidenceRecords = normalizeEvidence(evidence);
  return {
    id: `invoice-approval-${quote.id}`,
    title: `Approve exact-sats invoice ${quote.id}`,
    category: 'revenue-action',
    status: 'ready-for-chairman-review',
    createdAtUtc: created,
    preparedBy: 'sats-invoice-quote-agent',
    summary: `Review a ${quote.amountSats} sats draft invoice for ${quote.customer} covering ${quote.offerId}.`,
    rationale:
      'Confirmed exact-sats invoices are the shortest non-custodial path from qualified service demand to BTC reserve receipts.',
    proposedAction: `Approve draft invoice ${quote.id} for ${quote.customer}: $${quote.usdPrice} payable as exactly ${quote.amountSats} sats to the published reserve address before ${quote.quoteExpiresAtUtc}. After approval, render and manually send the customer payment packet.`,
    execution: 'manual-chairman-action',
    requiredChairmanApproval: true,
    riskReview: [
      'The draft invoice routes only to the published BTC reserve address.',
      'The quote includes exact sats, source, created timestamp, and expiration.',
      'No agent may send the payment packet before Executive Chairman approval.',
      'No agent may receive funds, hold keys, redirect payment, grant tokens, or move assets.',
      'The invoice disclosure rejects price guarantees, redemption promises, revenue guarantees, and market-support commitments.'
    ],
    publicDisclosure: quote.publicDisclosure,
    evidence: [
      {
        type: 'draft-invoice',
        url: 'public/sats-invoice-queue.json',
        reference: quote.id
      },
      ...evidenceRecords
    ]
  };
}

export function calculateSatsFromUsd({ usd, btcUsd }) {
  const usdScaled = parsePositiveDecimal(usd, 'usd');
  const btcUsdScaled = parsePositiveDecimal(btcUsd, 'btcUsd');
  return ceilDiv(usdScaled * SATS_PER_BTC, btcUsdScaled);
}

function assertDraftInvoiceQuote({ invoiceQueue, quote }) {
  assertDraftShape(quote);
  if (quote.status !== 'draft') throw new Error(`${quote.id}: invoice must be draft.`);
  if (quote.chairmanApprovalRequired !== true) {
    throw new Error(`${quote.id}: chairmanApprovalRequired must be true.`);
  }
  if (quote.paymentAddress !== invoiceQueue.paymentPolicy?.reserveAddress) {
    throw new Error(`${quote.id}: payment address must match the published reserve address.`);
  }
  for (const field of ['amountSats', 'quoteSource', 'quoteCreatedAtUtc', 'quoteExpiresAtUtc']) {
    if (/quote-required-before-sending/i.test(quote[field])) {
      throw new Error(`${quote.id}: ${field} must be completed before review staging.`);
    }
  }
  if (!/^\d+$/.test(quote.amountSats) || BigInt(quote.amountSats) <= 0n) {
    throw new Error(`${quote.id}: amountSats must be a positive integer string.`);
  }
  const created = new Date(quote.quoteCreatedAtUtc).getTime();
  const expires = new Date(quote.quoteExpiresAtUtc).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(expires) || expires <= created) {
    throw new Error(`${quote.id}: quote timestamps are invalid.`);
  }
  if (!/No price guarantee/i.test(quote.publicDisclosure ?? '')) {
    throw new Error(`${quote.id}: publicDisclosure must include no-price-guarantee language.`);
  }
}

function assertDraftShape(quote) {
  if (!quote || typeof quote !== 'object') throw new Error('Missing quote.');
  for (const field of [
    'id',
    'status',
    'offerId',
    'customer',
    'usdPrice',
    'settlementCurrency',
    'paymentAddress',
    'amountSats',
    'quoteSource',
    'quoteCreatedAtUtc',
    'quoteExpiresAtUtc',
    'deliverable',
    'publicDisclosure'
  ]) {
    if (!quote[field] || typeof quote[field] !== 'string') {
      throw new Error(`${quote.id ?? '<missing-id>'}: missing quote field ${field}.`);
    }
  }
}

function parsePositiveDecimal(value, label) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`${label} must be a positive decimal.`);

  const [whole, fraction = ''] = raw.split('.');
  const scaled = BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(6, '0').slice(0, 6));
  if (scaled <= 0n) throw new Error(`${label} must be greater than zero.`);
  return scaled;
}

function normalizeIsoDate(value, label) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date.toISOString();
}

function addMinutes(isoDate, minutes) {
  const ttl = Number(minutes);
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > 1440) {
    throw new Error('ttlMinutes must be an integer from 1 to 1440.');
  }
  return new Date(new Date(isoDate).getTime() + ttl * 60_000).toISOString();
}

function ceilDiv(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'customer';
}

function normalizeEvidence(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .map((reference) => ({
      type: 'invoice-request-evidence',
      reference
    }));
}
