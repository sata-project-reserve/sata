import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildInboundLeadPlan,
  recordInboundLead,
  validateInboundLeadQueue
} from './lib/inbound-service-leads.mjs';

const queue = readJson(join('public', 'inbound-service-lead-queue.json'));
const paidPromotionLedger = readJson(join('public', 'paid-promotion-ledger.json'));
const socialQueue = readJson(join('public', 'social-agent-content-queue.json'));
const agent = readFileSync(join('scripts', 'inbound-service-lead-agent.mjs'), 'utf8');
const findings = [];

validateInboundLeadQueue(queue);
const plan = buildInboundLeadPlan({ queue, paidPromotionLedger, socialQueue });
if (plan.mode !== 'inbound-service-lead-plan') {
  findings.push('plan mode must be inbound-service-lead-plan');
}
if (plan.totals.liveAttributionSources < 1) {
  findings.push('plan must surface live attribution sources for inbound monitoring');
}
if (!/record-lead/.test(agent)) {
  findings.push('agent must expose record-lead command');
}
if (!/customerAskedForInvoice/.test(agent)) {
  findings.push('agent must accept customerAskedForInvoice flag');
}

const recorded = recordInboundLead({
  queue,
  leadId: 'example-inbound-lead',
  sourceType: 'paid-promotion-reply',
  sourceId: 'diana-crypto-20260903-transparency-tweet',
  contactHandle: 'example-team',
  publicProfileUrl: 'https://x.com/example_team',
  projectUrl: 'https://example.invalid',
  requestedOfferId: 'transparency-audit',
  evidence: 'Inbound DM evidence from https://x.com/example_team/status/123456789',
  customerAskedForInvoice: true,
  notes: 'Customer asked for invoice; no payment instructions sent.'
});
const lead = recorded.leads.find((item) => item.id === 'example-inbound-lead');
if (lead?.status !== 'invoice-requested-needs-chairman-review') {
  findings.push('invoice-requesting inbound leads must stay in chairman-review status');
}
if (!/chairman review/i.test(lead?.nextAction ?? '')) {
  findings.push('invoice-requesting inbound leads must route to chairman review');
}
validateInboundLeadQueue(recorded);

assertRejects('bad source type', /Unsupported sourceType/i, () =>
  recordInboundLead({
    queue,
    leadId: 'bad-source',
    sourceType: 'unapproved',
    sourceId: 'source',
    contactHandle: 'team',
    publicProfileUrl: 'https://x.com/team',
    projectUrl: 'https://team.invalid',
    evidence: 'valid evidence'
  })
);
assertRejects('bad profile URL', /publicProfileUrl must be an http\(s\) URL/i, () =>
  recordInboundLead({
    queue,
    leadId: 'bad-profile-url',
    sourceType: 'x-dm',
    sourceId: 'dm',
    contactHandle: 'team',
    publicProfileUrl: 'x.com/team',
    projectUrl: 'https://team.invalid',
    evidence: 'valid evidence'
  })
);

if (findings.length > 0) {
  console.error('Inbound service lead check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Inbound service lead check passed: inbound replies are captured without bypassing chairman invoice gates.');

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
