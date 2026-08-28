import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildInvoiceQuoteDraft, calculateSatsFromUsd } from './lib/sats-invoice-quote.mjs';

const queue = JSON.parse(readFileSync(join('public', 'sats-invoice-queue.json'), 'utf8'));
const quote = buildInvoiceQuoteDraft({
  queue,
  offerId: 'transparency-audit',
  customer: 'Example Proof Token',
  btcUsd: '100000',
  quoteSource: 'Manual test rate',
  createdAtUtc: '2026-08-28T00:00:00.000Z',
  ttlMinutes: 30
});
const findings = [];

if (calculateSatsFromUsd({ usd: '50', btcUsd: '100000' }).toString() !== '50000') {
  findings.push('quote calculator must convert $50 at $100,000/BTC to 50,000 sats');
}
if (quote.status !== 'draft') findings.push('quote output must remain a draft');
if (quote.amountSats !== '50000') findings.push('quote amountSats must be exact for the fixture rate');
if (quote.quoteCreatedAtUtc !== '2026-08-28T00:00:00.000Z') {
  findings.push('quoteCreatedAtUtc must preserve the provided ISO timestamp');
}
if (quote.quoteExpiresAtUtc !== '2026-08-28T00:30:00.000Z') {
  findings.push('quoteExpiresAtUtc must apply the ttlMinutes window');
}
if (quote.paymentAddress !== queue.paymentPolicy.reserveAddress) {
  findings.push('quote paymentAddress must match the invoice queue reserve address');
}
if (quote.chairmanApprovalRequired !== true) {
  findings.push('quote must require chairman approval');
}
if (!/Draft quote only/i.test(quote.boundary)) {
  findings.push('quote boundary must state this is a draft only');
}
if (!/payment instruction is sent/i.test(quote.boundary)) {
  findings.push('quote boundary must require approval before payment instructions are sent');
}

if (findings.length > 0) {
  console.error('Sats invoice quoter check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats invoice quoter check passed: manual BTC/USD rates produce draft exact-sats invoices.');
