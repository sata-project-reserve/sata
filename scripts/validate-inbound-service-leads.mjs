import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildInboundLeadPlan,
  recordInboundLead,
  validateInboundLeadQueue
} from './lib/inbound-service-leads.mjs';
import {
  recordReferralHandoffLeadConversion,
  validateReferralPartnerHandoffQueue
} from './lib/referral-partner-handoffs.mjs';

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
for (const source of plan.liveAttributionSources) {
  if (!/inbound-service-lead-agent\.mjs record-lead/.test(source.recordLeadCommand ?? '')) {
    findings.push(`${source.id}: live attribution source must expose a record-lead command`);
  }
  if (!/--recordedAtUtc "<recorded-at-utc>"/.test(source.recordLeadCommand ?? '')) {
    findings.push(`${source.id}: record-lead command must require explicit recordedAtUtc evidence`);
  }
}
if (!/record-lead/.test(agent)) {
  findings.push('agent must expose record-lead command');
}
if (!/record-from-intake-issue-json/.test(agent)) {
  findings.push('agent must expose record-from-intake-issue-json command');
}
if (!/Missing --recordedAtUtc/.test(agent)) {
  findings.push('intake issue lead recording must require explicit recordedAtUtc evidence');
}
if (!/customerAskedForInvoice/.test(agent)) {
  findings.push('agent must accept customerAskedForInvoice flag');
}
if (!/recordedAtUtc: options\.recordedAtUtc/.test(agent)) {
  findings.push('agent must accept recordedAtUtc for inbound lead evidence');
}
if (!/convertedAtUtc: options\.convertedAtUtc \?\? options\.recordedAtUtc/.test(agent)) {
  findings.push(
    'agent must pass explicit convertedAtUtc or recordedAtUtc for referral handoff conversion'
  );
}
if (!/recordReferralHandoffLeadConversion/.test(agent)) {
  findings.push('agent must close accepted referral handoffs when referred leads are recorded');
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
  recordedAtUtc: '2026-09-10T12:15:00.000Z',
  notes: 'Customer asked for invoice; no payment instructions sent.'
});
const lead = recorded.leads.find((item) => item.id === 'example-inbound-lead');
if (lead?.status !== 'invoice-requested-needs-chairman-review') {
  findings.push('invoice-requesting inbound leads must stay in chairman-review status');
}
if (!/chairman review/i.test(lead?.nextAction ?? '')) {
  findings.push('invoice-requesting inbound leads must route to chairman review');
}
if (lead?.recordedAtUtc !== '2026-09-10T12:15:00.000Z') {
  findings.push('inbound leads must preserve explicit recordedAtUtc evidence');
}
validateInboundLeadQueue(recorded);

const referralHandoffQueue = {
  project: 'SATA Reserve Token',
  schemaVersion: 1,
  updatedAtUtc: '2026-09-10T12:00:00.000Z',
  mode: 'referral-partner-handoff-control',
  objective:
    'Record no-upfront, post-receipt referral handoffs created from completed paid-promotion experiments so partner follow-up can generate qualified service leads and eventual reserve sats without repeat upfront spend.',
  handoffStatuses: [
    'sent-awaiting-response',
    'accepted-awaiting-referred-lead',
    'converted-to-lead',
    'declined',
    'closed-no-response'
  ],
  policy: {
    sourceCampaignMustBeCompleted: true,
    requiresZeroConfirmedReceiptSats: true,
    requiresApprovedReferralPolicy: true,
    paymentInstructionsAllowed: false,
    upfrontCompensationAllowed: false,
    assetMovementAllowed: false,
    requiredBoundary:
      'No partner-specific compensation, invoice, payment instruction, token grant, cash payment, public post, or asset movement before separate Executive Chairman approval.'
  },
  requiredHandoffFields: [
    'id',
    'sourceCampaignId',
    'partner',
    'sourceEvidence',
    'status',
    'sentEvidence',
    'sentAtUtc',
    'nextAction'
  ],
  handoffs: [
    {
      id: 'handoff-diana-campaign',
      sourceCampaignId: 'diana-campaign',
      partner: {
        id: 'diana-crypto',
        displayName: 'Diana Crypto',
        handle: '142C_',
        profileUrl: 'https://x.com/142C_'
      },
      sourceEvidence: 'https://x.com/142C_/status/2086570576530010172',
      status: 'accepted-awaiting-referred-lead',
      sentEvidence: 'DM evidence showing post-receipt referral terms were sent.',
      sentAtUtc: '2026-09-10T12:00:00.000Z',
      responseEvidence: 'Partner accepted post-receipt referral terms.',
      respondedAtUtc: '2026-09-10T12:05:00.000Z',
      nextAction:
        'Record any referred customer as an inbound manual-referral lead before invoice review.',
      boundary:
        'This handoff does not approve compensation, invoices, payment instructions, token grants, public posts, or asset movement.'
    }
  ],
  boundary:
    'This queue records referral handoff evidence only. It does not approve any partner, compensation, public post, invoice, payment instruction, token grant, custody change, transaction, or asset movement.'
};
const convertedReferralHandoffQueue = recordReferralHandoffLeadConversion({
  queue: referralHandoffQueue,
  sourceId: 'referral-partner-diana-crypto',
  leadId: 'example-inbound-lead',
  evidence: 'Inbound DM evidence from referred customer.',
  convertedAtUtc: '2026-09-10T12:10:00.000Z'
});
const convertedHandoff = convertedReferralHandoffQueue.handoffs[0];
if (convertedHandoff.status !== 'converted-to-lead') {
  findings.push('accepted referral handoff must move to converted-to-lead after lead evidence');
}
if (convertedHandoff.referredLeadId !== 'example-inbound-lead') {
  findings.push('converted referral handoff must record the referred lead id');
}
validateReferralPartnerHandoffQueue(convertedReferralHandoffQueue);

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
    evidence: 'valid evidence',
    recordedAtUtc: '2026-09-10T12:15:00.000Z'
  })
);
assertRejects('bad recordedAtUtc', /recordedAtUtc must be a valid date/i, () =>
  recordInboundLead({
    queue,
    leadId: 'bad-recorded-at',
    sourceType: 'x-dm',
    sourceId: 'dm',
    contactHandle: 'team',
    publicProfileUrl: 'https://x.com/team',
    projectUrl: 'https://team.invalid',
    evidence: 'valid evidence',
    recordedAtUtc: 'not-a-date'
  })
);
assertRejects('missing recordedAtUtc', /recordedAtUtc must be a valid date/i, () =>
  recordInboundLead({
    queue,
    leadId: 'missing-recorded-at',
    sourceType: 'x-dm',
    sourceId: 'dm',
    contactHandle: 'team',
    publicProfileUrl: 'https://x.com/team',
    projectUrl: 'https://team.invalid',
    evidence: 'valid evidence'
  })
);

if (findings.length > 0) {
  console.error('Inbound service lead check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Inbound service lead check passed: inbound replies are captured without bypassing chairman invoice gates.'
);

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
