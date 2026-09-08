import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildInboundInvoiceRequestPacket,
  renderInboundInvoiceRequestPacket
} from './lib/inbound-invoice-request-packet.mjs';
import { recordInboundLead } from './lib/inbound-service-leads.mjs';

const inboundQueue = readJson(join('public', 'inbound-service-lead-queue.json'));
const invoiceQueue = readJson(join('public', 'sats-invoice-queue.json'));
const agent = readFileSync(join('scripts', 'inbound-invoice-request-agent.mjs'), 'utf8');
const findings = [];

const queueWithLead = recordInboundLead({
  queue: inboundQueue,
  leadId: 'example-paid-service-buyer',
  sourceType: 'paid-promotion-reply',
  sourceId: 'diana-crypto-20260903-transparency-tweet',
  contactHandle: 'example-buyer',
  publicProfileUrl: 'https://x.com/example_buyer',
  projectUrl: 'https://example.invalid',
  requestedOfferId: 'transparency-report-setup',
  evidence: 'Inbound DM evidence: customer asked for a transparency setup invoice.',
  customerAskedForInvoice: true,
  notes: 'No payment instructions sent before chairman review.'
});

const packet = buildInboundInvoiceRequestPacket({
  inboundQueue: queueWithLead,
  invoiceQueue,
  leadIds: 'example-paid-service-buyer',
  generatedAtUtc: '2026-09-05T00:00:00.000Z'
});

if (packet.mode !== 'chairman-gated-inbound-invoice-request-packet') {
  findings.push('packet mode must be chairman-gated-inbound-invoice-request-packet');
}
if (packet.requestCount !== 1) {
  findings.push('packet must include the selected inbound invoice request');
}
const request = packet.requests[0];
if (request?.offerId !== 'transparency-report-setup' || request?.usdPrice !== '150') {
  findings.push('packet request must preserve inbound requested offer and invoice template price');
}
if (request?.paymentAddress !== invoiceQueue.paymentPolicy.reserveAddress) {
  findings.push('packet request payment address must match invoice queue reserve address');
}
if (!/sats-invoice-quote-agent\.mjs quote-template/.test(request?.quoteCommand ?? '')) {
  findings.push('packet must include quote-template command');
}
if (!/chairman-selected-rate/.test(request?.quoteCommand ?? '')) {
  findings.push('quote command must require chairman-selected rate');
}
if (!/Executive Chairman approval is required/i.test(request?.approvalRequired ?? '')) {
  findings.push('request must require Executive Chairman approval');
}
if (/approve an invoice|payment instruction, paid work/i.test(packet.boundary ?? '') === false) {
  findings.push('packet boundary must block invoice/payment approval');
}

const rendered = renderInboundInvoiceRequestPacket({
  inboundQueue: queueWithLead,
  invoiceQueue,
  leadIds: 'example-paid-service-buyer',
  generatedAtUtc: '2026-09-05T00:00:00.000Z'
});
for (const required of [
  /SATA Inbound Invoice Request Packet/i,
  /example-paid-service-buyer/i,
  /transparency-report-setup/i,
  /Executive Chairman approval is required/i,
  /does not approve an invoice/i
]) {
  if (!required.test(rendered)) findings.push(`rendered packet missing ${required}`);
}

if (!/render/.test(agent) || !/inbound-invoice-request-planner/.test(agent)) {
  findings.push('agent must expose plan/json and render commands');
}

assertRejects('non-invoice lead', /inbound invoice request requires/i, () =>
  buildInboundInvoiceRequestPacket({
    inboundQueue: recordInboundLead({
      queue: inboundQueue,
      leadId: 'example-needs-intake',
      sourceType: 'x-dm',
      sourceId: 'dm-example',
      contactHandle: 'example-intake',
      publicProfileUrl: 'https://x.com/example_intake',
      projectUrl: 'https://example.invalid',
      requestedOfferId: 'transparency-audit',
      evidence: 'Inbound DM evidence: asked a generic question.',
      customerAskedForInvoice: false
    }),
    invoiceQueue,
    leadIds: 'example-needs-intake'
  })
);

if (findings.length > 0) {
  console.error('Inbound invoice request packet check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Inbound invoice request packet check passed: inbound invoice demand stays chairman-gated.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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
