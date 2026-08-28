const SATS_PER_BTC = 100_000_000n;
const DECIMAL_SCALE = 1_000_000n;

export function buildInvoiceQuoteDraft({
  queue,
  offerId,
  customer,
  btcUsd,
  quoteSource,
  createdAtUtc = new Date().toISOString(),
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

export function calculateSatsFromUsd({ usd, btcUsd }) {
  const usdScaled = parsePositiveDecimal(usd, 'usd');
  const btcUsdScaled = parsePositiveDecimal(btcUsd, 'btcUsd');
  return ceilDiv(usdScaled * SATS_PER_BTC, btcUsdScaled);
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
