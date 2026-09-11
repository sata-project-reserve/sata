import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReferralHandoffEvidenceDraft } from './lib/referral-handoff-evidence-parser.mjs';
import { renderReferralHandoffEvidenceComment } from './referral-handoff-evidence-comment-agent.mjs';

const queue = readJson(join('public', 'referral-partner-handoff-queue.json'));
const paidPromotionLedger = readJson(join('public', 'paid-promotion-ledger.json'));
const referralPartnerPolicy = readJson(join('public', 'referral-partner-policy.json'));
const inboundQueue = readJson(join('public', 'inbound-service-lead-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'referral-handoff-evidence-issue.json'));
const form = readFileSync(join('.github', 'ISSUE_TEMPLATE', 'referral-handoff-evidence.yml'), 'utf8');
const workflow = readFileSync(join('.github', 'workflows', 'referral-handoff-evidence.yml'), 'utf8');
const evidenceAgent = readFileSync(join('scripts', 'referral-handoff-evidence-agent.mjs'), 'utf8');
const agent = readFileSync(join('scripts', 'referral-partner-handoff-agent.mjs'), 'utf8');
const packageJson = readJson('package.json');
const draft = buildReferralHandoffEvidenceDraft({
  issue: issueFixture,
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
});
const comment = renderReferralHandoffEvidenceComment(draft);
const findings = [];

if (!/referral-handoff-evidence/.test(form)) {
  findings.push('issue form must apply the referral-handoff-evidence label');
}
if (!/manual-evidence/.test(form)) {
  findings.push('issue form must apply the manual-evidence label');
}
for (const required of [
  /Source campaign ID/,
  /Partner handle/,
  /Sent evidence URL or reference/,
  /Approved terms SHA-256/,
  /Exact referral terms sent/,
  /Sent at UTC/,
  /approved post-receipt referral handoff terms/i,
  /does not approve a partner/i
]) {
  if (!required.test(form)) findings.push(`issue form missing ${required}`);
}
if (!/id: sentAtUtc[\s\S]*?required: true/.test(form)) {
  findings.push('issue form must require sentAtUtc because record-sent rejects missing timestamps');
}
if (/payment address|send payment|private key|seed phrase/i.test(form)) {
  findings.push('issue form must not request payments or wallet secrets');
}
if (
  packageJson.scripts?.['ops:referral-handoff-evidence-check'] !==
  'node scripts/validate-referral-handoff-evidence.mjs'
) {
  findings.push('package.json must expose ops:referral-handoff-evidence-check');
}
if (
  packageJson.scripts?.['ops:referral-handoff-evidence-plan'] !==
  'node scripts/referral-handoff-evidence-agent.mjs plan'
) {
  findings.push('package.json must expose ops:referral-handoff-evidence-plan');
}
if (!draft.readyToRecord) {
  findings.push(`fixture should be ready to record: ${draft.findings.join('; ')}`);
}
if (!draft.termsMatchApprovedPacket) {
  findings.push('fixture terms must match approved referral handoff packet exactly');
}
if (!draft.hashMatchesApprovedPacket) {
  findings.push('fixture approved terms SHA-256 must match approved referral handoff packet');
}
if (
  !/referral-partner-handoff-agent\.mjs record-sent --campaign diana-crypto-20260903-transparency-tweet/.test(
    draft.operatorCommand ?? ''
  )
) {
  findings.push('operator command must use referral handoff record-sent command');
}
if (!/--evidence "https:\/\/x\.com\/example\/status\/109"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must use the submitted sent evidence URL');
}
if (!/--sentAtUtc "2026-09-10T12:00:00.000Z"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve sentAtUtc when provided');
}
if (!/--messageHash 71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must include approved terms SHA-256');
}
if (!/sentAtUtc: options\.sentAtUtc/.test(agent)) {
  findings.push('referral handoff agent must pass sentAtUtc through to record-sent');
}
if (!/messageHash: options\.messageHash/.test(agent)) {
  findings.push('referral handoff agent must pass approved terms hash through to record-sent');
}
if (!/does not send referral terms/i.test(draft.boundary ?? '')) {
  findings.push('draft boundary must say it does not send referral terms');
}
if (!/does not .*move assets/i.test(draft.boundary ?? '')) {
  findings.push('draft boundary must prohibit asset movement');
}
if (!comment.includes('<!-- sata-referral-handoff-evidence-review -->')) {
  findings.push('comment must include stable marker');
}
if (!/No partner, compensation, invoice/i.test(comment)) {
  findings.push('comment must preserve no-approval boundary');
}
if (!/Operator command/.test(comment)) {
  findings.push('comment must expose the operator command section');
}
if (!/Approved terms SHA-256/.test(comment) || !/Hash matches approved packet: true/.test(comment)) {
  findings.push('comment must expose approved terms hash match status');
}
if (!/approved SHA-256 match the packet/i.test(evidenceAgent)) {
  findings.push('evidence agent plan must mention the approved hash match requirement');
}
for (const expected of [
  'referral-handoff-evidence',
  'ops:referral-handoff-evidence-check',
  'referral-handoff-evidence-comment-agent.mjs comment-from-event-json',
  '<!-- sata-referral-handoff-evidence-review -->'
]) {
  if (!workflow.includes(expected)) findings.push(`workflow missing ${expected}`);
}
if (/record-sent|ops:approve|ops:reject|social:agent:post/.test(workflow)) {
  findings.push('workflow must not execute state-changing or external-publishing commands');
}

const alteredTermsIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('No upfront payment', 'Upfront payment is fine')
};
const alteredTermsDraft = buildReferralHandoffEvidenceDraft({
  issue: alteredTermsIssue,
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
});
if (alteredTermsDraft.readyToRecord) {
  findings.push('altered terms must not be ready to record');
}
if (!alteredTermsDraft.findings.some((finding) => /do not match/i.test(finding))) {
  findings.push('altered terms must report exact terms mismatch');
}

const wrongHandleIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('### Partner handle\n142C_', '### Partner handle\nwrong_handle')
};
const wrongHandleDraft = buildReferralHandoffEvidenceDraft({
  issue: wrongHandleIssue,
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
});
if (wrongHandleDraft.readyToRecord) {
  findings.push('wrong handle issue must not be ready to record');
}
if (!wrongHandleDraft.findings.some((finding) => /Partner handle mismatch/i.test(finding))) {
  findings.push('wrong handle issue must report partner handle mismatch');
}

const wrongHashIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    '### Approved terms SHA-256\n71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18',
    `### Approved terms SHA-256\n${'0'.repeat(64)}`
  )
};
const wrongHashDraft = buildReferralHandoffEvidenceDraft({
  issue: wrongHashIssue,
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
});
if (wrongHashDraft.readyToRecord) {
  findings.push('wrong approved terms hash issue must not be ready to record');
}
if (!wrongHashDraft.findings.some((finding) => /SHA-256 does not match/i.test(finding))) {
  findings.push('wrong approved terms hash issue must report hash mismatch');
}

const malformedHashIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    '### Approved terms SHA-256\n71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18',
    '### Approved terms SHA-256\nnot-a-valid-hash'
  )
};
const malformedHashDraft = buildReferralHandoffEvidenceDraft({
  issue: malformedHashIssue,
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
});
if (malformedHashDraft.readyToRecord) {
  findings.push('malformed approved terms hash issue must not be ready to record');
}
if (!malformedHashDraft.findings.some((finding) => /64-character lowercase hex/i.test(finding))) {
  findings.push('malformed approved terms hash issue must report format error');
}

const missingTimestampIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(/\n\n### Sent at UTC\n2026-09-10T12:00:00\.000Z\n/, '\n')
};
const missingTimestampDraft = buildReferralHandoffEvidenceDraft({
  issue: missingTimestampIssue,
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
});
if (missingTimestampDraft.readyToRecord) {
  findings.push('missing sentAtUtc issue must not be ready to record');
}
if (!missingTimestampDraft.findings.some((finding) => /Missing required fields: sentAtUtc/i.test(finding))) {
  findings.push('missing sentAtUtc issue must report missing timestamp');
}

const malformedTimestampIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('### Sent at UTC\n2026-09-10T12:00:00.000Z', '### Sent at UTC\nnot-a-date')
};
const malformedTimestampDraft = buildReferralHandoffEvidenceDraft({
  issue: malformedTimestampIssue,
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
});
if (malformedTimestampDraft.readyToRecord) {
  findings.push('malformed sentAtUtc issue must not be ready to record');
}
if (!malformedTimestampDraft.findings.some((finding) => /valid ISO timestamp/i.test(finding))) {
  findings.push('malformed sentAtUtc issue must report timestamp format error');
}

if (findings.length > 0) {
  console.error('Referral handoff evidence check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Referral handoff evidence check passed: partner terms evidence can be reviewed without mutating state.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
