import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReferralPartnerHandoffPlan,
  recordReferralHandoffLeadConversion,
  recordReferralHandoffResponse,
  recordReferralHandoffSent,
  validateReferralPartnerHandoffQueue
} from './lib/referral-partner-handoffs.mjs';

const queue = readJson(join('public', 'referral-partner-handoff-queue.json'));
const paidPromotionLedger = readJson(join('public', 'paid-promotion-ledger.json'));
const referralPartnerPolicy = readJson(join('public', 'referral-partner-policy.json'));
const inboundQueue = readJson(join('public', 'inbound-service-lead-queue.json'));
const agent = readFileSync(join('scripts', 'referral-partner-handoff-agent.mjs'), 'utf8');
const findings = [];

validateReferralPartnerHandoffQueue(queue);
const plan = buildReferralPartnerHandoffPlan({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  generatedAtUtc: '2026-09-10T11:00:00.000Z'
});

if (plan.mode !== 'referral-partner-handoff-plan') {
  findings.push('plan mode must be referral-partner-handoff-plan');
}
if (plan.totals.unrecordedHandoffCandidates < 1) {
  findings.push(
    'plan must identify the completed zero-receipt Diana campaign as a handoff candidate'
  );
}
if (!plan.candidates[0]?.recordSentCommand?.includes('record-sent --campaign')) {
  findings.push('candidate must expose record-sent evidence command');
}
if (!plan.candidates[0]?.writePacketCommand?.includes('write-packet --campaign')) {
  findings.push('candidate must expose write-packet artifact command');
}
if (!plan.candidates[0]?.recordSentCommand?.includes('--sentAtUtc "<sent-at-utc>"')) {
  findings.push('candidate record-sent command must require explicit sentAtUtc evidence');
}
if (!/--messageHash [a-f0-9]{64}/.test(plan.candidates[0]?.recordSentCommand ?? '')) {
  findings.push('candidate record-sent command must include approved terms SHA-256');
}
if (
  !plan.candidates[0]?.packet?.recordReferredLeadCommand?.includes('--sourceType manual-referral')
) {
  findings.push('candidate packet must preserve manual-referral lead recording');
}
if (
  !plan.candidates[0]?.packet?.recordReferredLeadCommand?.includes(
    '--recordedAtUtc "<recorded-at-utc>"'
  )
) {
  findings.push('candidate packet must require recordedAtUtc evidence for referred leads');
}
if (
  !plan.candidates[0]?.packet?.recordReferredLeadCommand?.includes(
    '--convertedAtUtc "<converted-at-utc>"'
  )
) {
  findings.push('candidate packet must require convertedAtUtc evidence for referred leads');
}
if (!/record-response/.test(agent)) {
  findings.push('agent must expose record-response command');
}
if (!/write-packet/.test(agent)) {
  findings.push('agent must expose write-packet command for reviewable manual handoff artifacts');
}

const sent = recordReferralHandoffSent({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  campaignId: 'diana-crypto-20260903-transparency-tweet',
  sentEvidence: 'DM evidence showing post-receipt referral terms were sent.',
  sentAtUtc: '2026-09-10T11:05:00.000Z',
  messageHash: plan.candidates[0].packet.termsSha256
});
const handoff = sent.handoffs.find(
  (item) => item.sourceCampaignId === 'diana-crypto-20260903-transparency-tweet'
);
if (handoff?.status !== 'sent-awaiting-response') {
  findings.push('record-sent must create a sent-awaiting-response handoff');
}
validateReferralPartnerHandoffQueue(sent);

const accepted = recordReferralHandoffResponse({
  queue: sent,
  handoffId: handoff.id,
  accepted: 'true',
  evidence: 'Partner accepted post-receipt referral terms in DM.',
  respondedAtUtc: '2026-09-10T11:10:00.000Z'
});
if (accepted.handoffs[0]?.status !== 'accepted-awaiting-referred-lead') {
  findings.push('accepted response must wait for referred customer lead evidence');
}
validateReferralPartnerHandoffQueue(accepted);

const responsePlan = buildReferralPartnerHandoffPlan({
  queue: sent,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  generatedAtUtc: '2026-09-10T11:12:00.000Z'
});
if (
  !/--respondedAtUtc "<responded-at-utc>"/.test(
    responsePlan.activeHandoffs[0]?.recordResponseCommand ?? ''
  )
) {
  findings.push('active handoff response command must require explicit respondedAtUtc evidence');
}

const noDuplicatePlan = buildReferralPartnerHandoffPlan({
  queue: sent,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  generatedAtUtc: '2026-09-10T11:15:00.000Z'
});
if (noDuplicatePlan.totals.unrecordedHandoffCandidates !== 0) {
  findings.push('recorded source campaigns must not remain handoff candidates');
}

const packetJsonPath = join('public', 'referral-partner-handoff-packet.json');
if (existsSync(packetJsonPath)) {
  const packetArtifact = readJson(packetJsonPath);
  if (packetArtifact.mode !== 'referral-partner-handoff-packet') {
    findings.push('handoff packet artifact mode must be referral-partner-handoff-packet');
  }
  if (packetArtifact.sourceCampaignId !== 'diana-crypto-20260903-transparency-tweet') {
    findings.push('handoff packet artifact must preserve the source campaign id');
  }
  if (!/does not record a send/i.test(packetArtifact.boundary ?? '')) {
    findings.push('handoff packet artifact boundary must state it does not record a send');
  }
  if (
    !/record-sent --campaign diana-crypto-20260903-transparency-tweet/.test(
      packetArtifact.recordSentCommand ?? ''
    )
  ) {
    findings.push('handoff packet artifact must expose Diana record-sent evidence command');
  }
}

assertRejects('duplicate handoff', /already recorded/i, () =>
  recordReferralHandoffSent({
    queue: sent,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    campaignId: 'diana-crypto-20260903-transparency-tweet',
    sentEvidence: 'duplicate evidence',
    messageHash: plan.candidates[0].packet.termsSha256
  })
);
assertRejects('bad evidence', /sent evidence is required/i, () =>
  recordReferralHandoffSent({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    campaignId: 'diana-crypto-20260903-transparency-tweet',
    sentEvidence: 'bad',
    messageHash: plan.candidates[0].packet.termsSha256
  })
);
assertRejects('missing terms hash', /terms SHA-256 is required/i, () =>
  recordReferralHandoffSent({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    campaignId: 'diana-crypto-20260903-transparency-tweet',
    sentEvidence: 'DM evidence showing post-receipt referral terms were sent.',
    sentAtUtc: '2026-09-10T11:05:00.000Z'
  })
);
assertRejects('wrong terms hash', /does not match/i, () =>
  recordReferralHandoffSent({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    campaignId: 'diana-crypto-20260903-transparency-tweet',
    sentEvidence: 'DM evidence showing post-receipt referral terms were sent.',
    sentAtUtc: '2026-09-10T11:05:00.000Z',
    messageHash: '0'.repeat(64)
  })
);
assertRejects('missing sent timestamp', /sentAtUtc must be a valid timestamp/i, () =>
  recordReferralHandoffSent({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    campaignId: 'diana-crypto-20260903-transparency-tweet',
    sentEvidence: 'DM evidence showing post-receipt referral terms were sent.',
    messageHash: plan.candidates[0].packet.termsSha256
  })
);
assertRejects('missing response timestamp', /respondedAtUtc must be a valid timestamp/i, () =>
  recordReferralHandoffResponse({
    queue: sent,
    handoffId: handoff.id,
    accepted: 'true',
    evidence: 'Partner accepted post-receipt referral terms in DM.'
  })
);
assertRejects('missing converted timestamp', /convertedAtUtc must be a valid timestamp/i, () =>
  recordReferralHandoffLeadConversion({
    queue: accepted,
    sourceId: 'referral-partner-diana-crypto',
    leadId: 'referred-lead',
    evidence: 'Referred customer asked about the transparency audit service.'
  })
);
assertRejects('upfront referral compensation', /post-receipt only|upfront payment/i, () =>
  recordReferralHandoffSent({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    campaignId: 'diana-crypto-20260903-transparency-tweet',
    sentEvidence: 'DM evidence showing post-receipt referral terms were sent.',
    sentAtUtc: '2026-09-10T11:05:00.000Z',
    messageHash: plan.candidates[0].packet.termsSha256,
    requestedCompensation: 'upfront $50 plus token grant'
  })
);
assertRejects('missing post receipt compensation gate', /post-receipt only/i, () =>
  recordReferralHandoffSent({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    campaignId: 'diana-crypto-20260903-transparency-tweet',
    sentEvidence: 'DM evidence showing post-receipt referral terms were sent.',
    sentAtUtc: '2026-09-10T11:05:00.000Z',
    messageHash: plan.candidates[0].packet.termsSha256,
    requestedCompensation: '10% referral share'
  })
);

if (findings.length > 0) {
  console.error('Referral partner handoff check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Referral partner handoff check passed: completed zero-receipt campaigns become evidenced post-receipt handoffs.'
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
