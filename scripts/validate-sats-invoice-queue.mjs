import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const queue = JSON.parse(readFileSync(join('public', 'sats-invoice-queue.json'), 'utf8'));
const report = JSON.parse(readFileSync(join('public', 'transparency', 'latest.json'), 'utf8'));
const findings = [];

if (queue.schemaVersion !== 1) findings.push('schemaVersion must be 1');
if (queue.mode !== 'chairman-approved-direct-reserve-invoices') {
  findings.push('mode must be chairman-approved-direct-reserve-invoices');
}
if (!/confirmed BTC reserve sats|BTC reserve sats|reserve/i.test(queue.purpose ?? '')) {
  findings.push('purpose must describe reserve-sats generation');
}

const reserveAddress = report.bitcoinReserve?.address;
if (!reserveAddress) findings.push('latest transparency report must include bitcoinReserve.address');
if (queue.paymentPolicy?.reserveAddress !== reserveAddress) {
  findings.push('paymentPolicy.reserveAddress must match the latest transparency reserve address');
}
if (!/exact sats amount/i.test(queue.paymentPolicy?.quoteRule ?? '')) {
  findings.push('quoteRule must require an exact sats amount');
}
if (!/No agent may receive funds|hold keys|redirect payments/i.test(queue.paymentPolicy?.custodyRule ?? '')) {
  findings.push('custodyRule must prohibit agent custody and payment redirection');
}

const invoices = queue.invoices ?? [];
if (invoices.length === 0) findings.push('invoices must include at least one template or invoice');
for (const invoice of invoices) {
  const label = invoice.id ?? '<missing-id>';
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
    if (!invoice[field] || typeof invoice[field] !== 'string') {
      findings.push(`${label}: missing string field ${field}`);
    }
  }
  if (invoice.chairmanApprovalRequired !== true) {
    findings.push(`${label}: chairmanApprovalRequired must be true`);
  }
  if (invoice.paymentAddress !== reserveAddress) {
    findings.push(`${label}: paymentAddress must match the latest transparency reserve address`);
  }
  if (!Array.isArray(invoice.postPaymentActions) || invoice.postPaymentActions.length === 0) {
    findings.push(`${label}: postPaymentActions must be a non-empty array`);
  }
  if (
    invoice.status !== 'template' &&
    [
      invoice.amountSats,
      invoice.quoteSource,
      invoice.quoteCreatedAtUtc,
      invoice.quoteExpiresAtUtc
    ].some((value) => /quote-required-before-sending/i.test(value))
  ) {
    findings.push(`${label}: non-template invoices require completed quote fields`);
  }
  if (!/No price guarantee/i.test(invoice.publicDisclosure)) {
    findings.push(`${label}: publicDisclosure must include no-price-guarantee language`);
  }
}

const prohibited = (queue.prohibitedInvoicePatterns ?? []).join('\n');
for (const required of [
  /agent custody/i,
  /private keys|seed phrases/i,
  /unapproved address/i,
  /chairman approval/i,
  /undisclosed paid promotion/i,
  /fake engagement|bots|raids|investor lists/i,
  /price|profit|return|redemption|market-support/i
]) {
  if (!required.test(prohibited)) findings.push(`prohibitedInvoicePatterns missing ${required}`);
}

if (findings.length > 0) {
  console.error('Sats invoice queue check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats invoice queue check passed: invoice-to-reserve controls are enforceable.');
