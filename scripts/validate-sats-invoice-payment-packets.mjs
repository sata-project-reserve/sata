import { renderInvoicePaymentPacket } from './lib/sats-invoice-payment-packet.mjs';

const reserveAddress = 'bc1q7dgqqyfh7gxn2kze874d07w4qcj43v4zptv6kk';
const queue = {
  paymentPolicy: {
    reserveAddress
  }
};
const approvedInvoice = {
  id: 'invoice-example-proof-token-transparency-audit-20260828',
  status: 'approved-by-chairman',
  approvedBy: 'executive-chairman',
  approvedAtUtc: '2026-08-28T00:05:00.000Z',
  offerId: 'transparency-audit',
  customer: 'Example Proof Token',
  usdPrice: '50',
  paymentAddress: reserveAddress,
  amountSats: '50000',
  quoteSource: 'Manual test rate',
  quoteCreatedAtUtc: '2026-08-28T00:00:00.000Z',
  quoteExpiresAtUtc: '2026-08-28T00:30:00.000Z',
  chairmanApprovalRequired: true,
  deliverable: 'One-page public-readiness audit covering token authorities, liquidity lock, reserve claims, and disclosure gaps.',
  publicDisclosure:
    'Service revenue may be paid directly into the BTC reserve. No price guarantee, no redemption promise, no revenue guarantee, and no market-support commitment.'
};
const findings = [];
const packet = renderInvoicePaymentPacket({
  invoice: approvedInvoice,
  queue,
  generatedAtUtc: '2026-08-28T00:10:00.000Z'
});

for (const required of [
  /exactly 50000 sats/i,
  new RegExp(reserveAddress),
  /Quote source: Manual test rate/i,
  /Quote expires: 2026-08-28T00:30:00.000Z/i,
  /No price guarantee/i,
  /approved by the SATA Executive Chairman/i,
  /agents do not receive funds/i
]) {
  if (!required.test(packet)) findings.push(`payment packet missing ${required}`);
}

for (const invoice of [
  { ...approvedInvoice, status: 'draft' },
  { ...approvedInvoice, approvedBy: undefined },
  { ...approvedInvoice, amountSats: 'quote-required-before-sending' },
  { ...approvedInvoice, paymentAddress: 'bc1qwrongaddress' }
]) {
  assertRejects(invoice);
}
assertRejects(approvedInvoice, '2026-08-28T00:31:00.000Z');

if (findings.length > 0) {
  console.error('Sats invoice payment packet check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats invoice payment packet check passed: only approved current invoices can render customer payment text.');

function assertRejects(invoice, generatedAtUtc = '2026-08-28T00:10:00.000Z') {
  try {
    renderInvoicePaymentPacket({ invoice, queue, generatedAtUtc });
    findings.push(`${invoice.id}: invalid invoice unexpectedly rendered`);
  } catch {
    // Expected: invalid payment packets must be rejected.
  }
}
