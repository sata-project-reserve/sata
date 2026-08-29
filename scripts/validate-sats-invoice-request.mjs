import {
  buildInvoiceRequestPacket,
  renderInvoiceRequestPacket
} from './lib/prospect-invoice-request.mjs';

const invoiceQueue = {
  paymentPolicy: {
    reserveAddress: 'bc1qexample'
  },
  invoices: [
    {
      status: 'template',
      offerId: 'transparency-audit',
      usdPrice: '50',
      settlementCurrency: 'BTC'
    }
  ]
};
const pipeline = {
  project: 'SATA Reserve Token',
  activeCycleId: 'revenue-cycle-001',
  prospects: [
    prospect({ id: 'invoice-team', stage: 'invoice-requested', approved: true }),
    prospect({ id: 'contacted-team', stage: 'contacted', approved: true }),
    prospect({ id: 'identified-team', stage: 'identified', approved: false })
  ]
};
const findings = [];

const packet = buildInvoiceRequestPacket({
  pipeline,
  invoiceQueue,
  prospectIds: 'invoice-team',
  generatedAtUtc: '2026-08-29T10:45:00.000Z'
});
const rendered = renderInvoiceRequestPacket({
  pipeline,
  invoiceQueue,
  prospectIds: 'invoice-team',
  generatedAtUtc: '2026-08-29T10:45:00.000Z'
});

if (packet.mode !== 'chairman-gated-invoice-request-packet') {
  findings.push('packet mode must be chairman-gated-invoice-request-packet');
}
if (packet.requests[0]?.usdPrice !== '50') findings.push('packet must use invoice template price');
if (packet.requests[0]?.paymentAddress !== invoiceQueue.paymentPolicy.reserveAddress) {
  findings.push('packet payment address must use the invoice queue reserve address');
}
if (!/chairman-selected-rate/.test(packet.requests[0]?.quoteCommand ?? '')) {
  findings.push('packet must require chairman-selected BTC/USD rate');
}
if (!/Executive Chairman approval is required/i.test(packet.requests[0]?.approvalRequired ?? '')) {
  findings.push('packet must require Executive Chairman approval before sending');
}
if (!/does not approve an invoice/i.test(packet.boundary)) {
  findings.push('packet boundary must reject implied invoice approval');
}

for (const required of [
  /SATA Invoice Request Packet/i,
  /invoice-team/i,
  /Quote command/i,
  /sats-invoice-quote-agent/i,
  /Executive Chairman approval/i,
  /does not approve an invoice/i
]) {
  if (!required.test(rendered)) findings.push(`rendered packet missing ${required}`);
}

for (const testCase of [
  {
    name: 'contacted prospect',
    prospectIds: 'contacted-team',
    expected: /requires invoice-requested stage/
  },
  {
    name: 'identified prospect',
    prospectIds: 'identified-team',
    expected: /requires invoice-requested stage/
  },
  {
    name: 'unknown prospect',
    prospectIds: 'missing-team',
    expected: /Prospect not found/
  }
]) {
  assertRejects(testCase.name, testCase.expected, () =>
    buildInvoiceRequestPacket({ pipeline, invoiceQueue, prospectIds: testCase.prospectIds })
  );
}

const noTemplate = {
  ...invoiceQueue,
  invoices: []
};
assertRejects('missing invoice template', /no invoice template/i, () =>
  buildInvoiceRequestPacket({ pipeline, invoiceQueue: noTemplate, prospectIds: 'invoice-team' })
);

if (findings.length > 0) {
  console.error('Sats invoice request check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats invoice request check passed: invoice quote preparation requires invoice-requested prospects and preserves approval gates.');

function prospect({ id, stage, approved }) {
  return {
    id,
    stage,
    source: 'test',
    publicProfileUrl: `https://x.com/${id}`,
    projectUrl: `https://${id}.invalid`,
    observedClaim: 'Public transparency claims need an evidence review.',
    recommendedOfferId: 'transparency-audit',
    chairmanApprovedBeforeOutreach: approved,
    evidence: [`https://${id}.invalid`]
  };
}

function assertRejects(name, expected, fn) {
  try {
    fn();
  } catch (error) {
    if (!expected.test(error.message)) {
      throw new Error(`${name}: expected ${expected}, received ${error.message}`);
    }
    return;
  }
  throw new Error(`${name}: expected rejection.`);
}
