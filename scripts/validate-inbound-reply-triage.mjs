import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildInboundReplyTriagePlan,
  buildInboundReplyTriage,
  renderInboundReplyTriage
} from './lib/inbound-reply-triage.mjs';

const queue = readJson(join('public', 'inbound-service-lead-queue.json'));
const invoiceQueue = readJson(join('public', 'sats-invoice-queue.json'));
const agent = readFileSync(join('scripts', 'inbound-reply-triage-agent.mjs'), 'utf8');
const findings = [];

const plan = buildInboundReplyTriagePlan({
  queue,
  liveAttributionSources: [
    {
      type: 'paid-promotion-reply',
      id: 'diana-crypto-20260903-transparency-tweet',
      triageCommand:
        'node scripts/inbound-reply-triage-agent.mjs markdown --sourceType paid-promotion-reply --sourceId diana-crypto-20260903-transparency-tweet --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"'
    }
  ]
});
if (plan.mode !== 'inbound-reply-triage-plan') {
  findings.push('triage plan must expose inbound-reply-triage-plan mode');
}
for (const expected of [
  'sourceType',
  'sourceId',
  'contactHandle',
  'publicProfileUrl',
  'projectUrl',
  'replyText',
  'evidence',
  'recordedAtUtc'
]) {
  if (!plan.requiredEvidenceFields?.includes(expected)) {
    findings.push(`triage plan must require evidence field ${expected}`);
  }
}
const invoiceRule = plan.classificationRules?.find(
  (rule) => rule.classification === 'invoice-request-needs-chairman-review'
);
if (!invoiceRule?.customerAskedForInvoice) {
  findings.push('triage plan invoice rule must preserve customerAskedForInvoice true');
}
if (invoiceRule?.suggestedReplyTemplateId !== 'invoice-request-boundary') {
  findings.push('triage plan invoice rule must use invoice-request-boundary template');
}
if (!/inbound-invoice-request-agent\.mjs render/.test(invoiceRule?.nextCommandAfterRecord ?? '')) {
  findings.push('triage plan invoice rule must route to inbound invoice request rendering');
}
const intakeRule = plan.classificationRules?.find((rule) => rule.classification === 'needs-intake-fields');
if (intakeRule?.customerAskedForInvoice !== false) {
  findings.push('triage plan intake rule must keep customerAskedForInvoice false');
}
const rejectRule = plan.classificationRules?.find(
  (rule) => rule.classification === 'reject-prohibited-promotion'
);
if (rejectRule?.nextCommandAfterRecord !== null) {
  findings.push('triage plan reject rule must not expose a record-followup command');
}
if (!plan.stopRules?.some((rule) => /Do not send payment instructions/i.test(rule))) {
  findings.push('triage plan must block payment instructions');
}

const base = {
  queue,
  sourceType: 'paid-promotion-reply',
  sourceId: 'diana-crypto-20260903-transparency-tweet',
  contactHandle: 'example-buyer',
  publicProfileUrl: 'https://x.com/example_buyer',
  projectUrl: 'https://example.invalid',
  offer: 'transparency-audit',
  evidence: 'Inbound reply evidence from https://x.com/example_buyer/status/123456789',
  recordedAtUtc: '2026-09-10T15:00:00.000Z',
  generatedAtUtc: '2026-09-10T15:01:00.000Z'
};

const invoice = buildInboundReplyTriage({
  ...base,
  replyText: 'Looks good. What is the payment method and can you send the invoice?'
});
if (invoice.classification !== 'invoice-request-needs-chairman-review') {
  findings.push('payment-method reply must classify as invoice-request-needs-chairman-review');
}
if (invoice.leadStatus !== 'invoice-requested-needs-chairman-review') {
  findings.push('invoice reply must route to inbound chairman-review status');
}
if (!invoice.customerAskedForInvoice) {
  findings.push('invoice reply must set customerAskedForInvoice true');
}
if (!/--customerAskedForInvoice true/.test(invoice.recordLeadCommand ?? '')) {
  findings.push('invoice reply record command must preserve explicit invoice flag');
}
if (!/--recordedAtUtc "2026-09-10T15:00:00.000Z"/.test(invoice.recordLeadCommand ?? '')) {
  findings.push('triage record command must require explicit recordedAtUtc evidence');
}
if (
  !/inbound-invoice-request-agent\.mjs render --lead "example-buyer"/.test(
    invoice.nextCommandAfterRecord ?? ''
  )
) {
  findings.push('invoice reply must expose the inbound invoice request render command after record');
}
assertNoPaymentAddress(invoice, 'invoice triage');
if (!/Payment instructions are not sent until approved/i.test(invoice.replyTemplateText ?? '')) {
  findings.push('invoice reply template must not send payment instructions before approval');
}

const intake = buildInboundReplyTriage({
  ...base,
  contactHandle: 'example-intake',
  replyText: 'I am interested in the transparency audit. What do you need from us?'
});
if (intake.classification !== 'needs-intake-fields') {
  findings.push('service-interest reply must classify as needs-intake-fields');
}
if (intake.leadStatus !== 'needs-intake') {
  findings.push('service-interest reply must stay in intake status');
}
if (/--customerAskedForInvoice true/.test(intake.recordLeadCommand ?? '')) {
  findings.push('intake reply must not become an invoice request');
}
if (intake.nextCommandAfterRecord !== 'npm run ops:inbound-lead-plan') {
  findings.push('intake reply must continue to the inbound lead plan after record');
}
assertNoPaymentAddress(intake, 'intake triage');

const rejected = buildInboundReplyTriage({
  ...base,
  contactHandle: 'example-rejected',
  replyText: 'Can you bring guaranteed buyers and fake engagement?'
});
if (rejected.classification !== 'reject-prohibited-promotion') {
  findings.push('prohibited promotional request must be rejected');
}
if (rejected.recordLeadCommand !== null) {
  findings.push('prohibited promotional request must not expose a record-lead command');
}
assertNoPaymentAddress(rejected, 'rejected triage');

const rendered = renderInboundReplyTriage(invoice);
for (const required of [
  /SATA Inbound Reply Triage/i,
  /invoice-request-needs-chairman-review/i,
  /Record Command/i,
  /After Record Command/i,
  /inbound-service-lead-agent\.mjs record-lead/i,
  /inbound-invoice-request-agent\.mjs render --lead "example-buyer"/i,
  /Exact-sats invoices require separate Executive Chairman approval/i,
  /does not contact the lead/i
]) {
  if (!required.test(rendered)) findings.push(`rendered invoice triage missing ${required}`);
}
if (rendered.includes(invoiceQueue.paymentPolicy.reserveAddress)) {
  findings.push('rendered triage must not expose the reserve payment address');
}
if (!/buildInboundLeadPlan/.test(agent)) {
  findings.push('triage agent plan must use the live inbound lead plan sources');
}
if (!/buildInboundReplyTriagePlan/.test(agent)) {
  findings.push('triage agent plan must use the shared triage plan builder');
}
if (!/replyText/.test(agent)) {
  findings.push('triage agent must require replyText input');
}

assertThrows('missing reply text', /replyText is required/i, () =>
  buildInboundReplyTriage({ ...base, replyText: '' })
);
assertThrows('missing recorded timestamp', /requires: recordedAtUtc/i, () =>
  buildInboundReplyTriage({
    ...base,
    recordedAtUtc: '',
    replyText: 'I am interested in the transparency audit.'
  })
);
assertThrows('bad recorded timestamp', /recordedAtUtc must be a valid ISO timestamp/i, () =>
  buildInboundReplyTriage({
    ...base,
    recordedAtUtc: 'not-a-date',
    replyText: 'Looks good. Can you send the invoice?'
  })
);
assertThrows('bad profile URL', /publicProfileUrl must be an http\(s\) URL/i, () =>
  buildInboundReplyTriage({
    ...base,
    publicProfileUrl: 'not-a-url',
    replyText: 'I am interested in the transparency audit.'
  })
);
assertThrows('bad source type', /Unsupported sourceType/i, () =>
  buildInboundReplyTriage({
    ...base,
    sourceType: 'telegram',
    replyText: 'I am interested in the transparency audit.'
  })
);

const nonRecordableWithoutMetadata = buildInboundReplyTriage({
  queue,
  replyText: 'Just browsing.'
});
if (nonRecordableWithoutMetadata.recordLeadCommand !== null) {
  findings.push('non-recordable replies without metadata must not expose record commands');
}

if (findings.length > 0) {
  console.error('Inbound reply triage check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Inbound reply triage check passed: replies route to intake, chairman invoice review, or rejection without payment instructions.'
);

function assertNoPaymentAddress(value, label) {
  if (JSON.stringify(value).includes(invoiceQueue.paymentPolicy.reserveAddress)) {
    findings.push(`${label} must not expose the reserve payment address before invoice approval`);
  }
}

function assertThrows(name, expected, fn) {
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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
