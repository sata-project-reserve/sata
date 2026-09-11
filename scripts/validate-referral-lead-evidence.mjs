import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReferralLeadEvidenceDraft } from './lib/referral-lead-evidence-parser.mjs';
import { renderReferralLeadEvidenceComment } from './referral-lead-evidence-comment-agent.mjs';

const baseQueue = readJson(join('public', 'referral-partner-handoff-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'referral-lead-evidence-issue.json'));
const form = readFileSync(join('.github', 'ISSUE_TEMPLATE', 'referral-lead-evidence.yml'), 'utf8');
const workflow = readFileSync(join('.github', 'workflows', 'referral-lead-evidence.yml'), 'utf8');
const packageJson = readJson('package.json');
const agent = readFileSync(join('scripts', 'referral-lead-evidence-agent.mjs'), 'utf8');
const handoffQueue = {
  ...baseQueue,
  handoffs: [
    {
      id: 'handoff-diana-crypto-20260903-transparency-tweet',
      sourceCampaignId: 'diana-crypto-20260903-transparency-tweet',
      partner: {
        id: 'diana-crypto',
        displayName: 'Diana Crypto',
        handle: '142C_',
        profileUrl: 'https://x.com/142C_'
      },
      sourceEvidence: 'https://x.com/142C_/status/2086570576530010172',
      requestedCompensation: 'post-receipt referral share',
      status: 'accepted-awaiting-referred-lead',
      sentEvidence: 'https://x.com/example/status/109',
      sentAtUtc: '2026-09-10T12:00:00.000Z',
      messageHash: '71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18',
      approvedTermsSha256: '71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18',
      responseEvidence: 'https://x.com/example/status/110',
      respondedAtUtc: '2026-09-10T12:30:00.000Z',
      nextAction:
        'Record any referred customer as an inbound manual-referral lead before invoice review.',
      boundary:
        'This handoff does not approve compensation, invoices, payment instructions, token grants, public posts, or asset movement.'
    }
  ]
};
const draft = buildReferralLeadEvidenceDraft({ issue: issueFixture, handoffQueue });
const comment = renderReferralLeadEvidenceComment(draft);
const findings = [];

if (!/referral-lead-evidence/.test(form)) {
  findings.push('issue form must apply the referral-lead-evidence label');
}
if (!/manual-evidence/.test(form)) {
  findings.push('issue form must apply the manual-evidence label');
}
for (const required of [
  /Referral handoff ID/,
  /Customer lead ID/,
  /Customer handle or contact/,
  /Customer public profile URL/,
  /Customer project URL/,
  /Requested offer ID/,
  /Referral evidence URL or reference/,
  /Customer interest summary/,
  /Customer asked for invoice/,
  /Recorded at UTC/,
  /Converted at UTC/,
  /does not approve compensation/i
]) {
  if (!required.test(form)) findings.push(`issue form missing ${required}`);
}
if (/payment address|send payment|private key|seed phrase/i.test(form)) {
  findings.push('issue form must not request payments or wallet secrets');
}
if (
  packageJson.scripts?.['ops:referral-lead-evidence-check'] !==
  'node scripts/validate-referral-lead-evidence.mjs'
) {
  findings.push('package.json must expose ops:referral-lead-evidence-check');
}
if (
  packageJson.scripts?.['ops:referral-lead-evidence-plan'] !==
  'node scripts/referral-lead-evidence-agent.mjs plan'
) {
  findings.push('package.json must expose ops:referral-lead-evidence-plan');
}
if (!draft.readyToRecord) {
  findings.push(`fixture should be ready to record: ${draft.findings.join('; ')}`);
}
if (draft.matchedHandoff?.referralSourceId !== 'referral-partner-diana-crypto') {
  findings.push('matched handoff must expose the manual-referral source id');
}
if (
  !/inbound-service-lead-agent\.mjs record-lead --lead "example-referred-project" --sourceType manual-referral --sourceId "referral-partner-diana-crypto"/.test(
    draft.operatorCommand ?? ''
  )
) {
  findings.push('operator command must record the referred customer as a manual-referral lead');
}
if (!/--customerAskedForInvoice false/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve customerAskedForInvoice false by default');
}
if (!/--recordedAtUtc "2026-09-10T13:00:00.000Z"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve recordedAtUtc');
}
if (!/--convertedAtUtc "2026-09-10T12:55:00.000Z"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve convertedAtUtc');
}
if (!/does not approve .*compensation/i.test(draft.boundary ?? '')) {
  findings.push('draft boundary must block compensation approval');
}
if (!comment.includes('<!-- sata-referral-lead-evidence-review -->')) {
  findings.push('comment must include stable marker');
}
if (!/No compensation, invoice, payment instruction/i.test(comment)) {
  findings.push('comment must preserve no-approval boundary');
}
if (!/Operator command/.test(comment)) {
  findings.push('comment must expose the operator command section');
}
if (!/draft-from-issue-json/.test(agent)) {
  findings.push('agent must expose draft-from-issue-json');
}
for (const expected of [
  'referral-lead-evidence',
  'ops:referral-lead-evidence-check',
  'referral-lead-evidence-comment-agent.mjs comment-from-event-json',
  '<!-- sata-referral-lead-evidence-review -->'
]) {
  if (!workflow.includes(expected)) findings.push(`workflow missing ${expected}`);
}
if (/record-lead|ops:approve|ops:reject|social:agent:post/.test(workflow)) {
  findings.push('workflow must not execute state-changing or external-publishing commands');
}

const pendingQueueDraft = buildReferralLeadEvidenceDraft({
  issue: issueFixture,
  handoffQueue: {
    ...handoffQueue,
    handoffs: [{ ...handoffQueue.handoffs[0], status: 'sent-awaiting-response' }]
  }
});
if (pendingQueueDraft.readyToRecord) {
  findings.push('non-accepted handoffs must not be ready to record a referred lead');
}
if (!pendingQueueDraft.findings.some((finding) => /not awaiting referred lead/i.test(finding))) {
  findings.push('non-accepted handoff must report status problem');
}

const badTimestampIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('### Recorded at UTC\n2026-09-10T13:00:00.000Z', '### Recorded at UTC\nnot-a-date')
};
const badTimestampDraft = buildReferralLeadEvidenceDraft({ issue: badTimestampIssue, handoffQueue });
if (badTimestampDraft.readyToRecord) {
  findings.push('bad recordedAtUtc issue must not be ready to record');
}
if (!badTimestampDraft.findings.some((finding) => /valid ISO timestamp/i.test(finding))) {
  findings.push('bad recordedAtUtc issue must report timestamp problem');
}

const unsafeIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('Customer asked about', 'Customer asked for guaranteed buyers and')
};
const unsafeDraft = buildReferralLeadEvidenceDraft({ issue: unsafeIssue, handoffQueue });
if (unsafeDraft.readyToRecord) {
  findings.push('unsafe customer interest summary must not be ready to record');
}
if (!unsafeDraft.findings.some((finding) => /prohibited/i.test(finding))) {
  findings.push('unsafe customer interest summary must report prohibited wording');
}

const invoiceRequestIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('### Customer asked for invoice\nfalse', '### Customer asked for invoice\ntrue')
};
const invoiceRequestDraft = buildReferralLeadEvidenceDraft({
  issue: invoiceRequestIssue,
  handoffQueue
});
if (!/--customerAskedForInvoice true/.test(invoiceRequestDraft.operatorCommand ?? '')) {
  findings.push('invoice-requesting referred leads must preserve customerAskedForInvoice true');
}

if (findings.length > 0) {
  console.error('Referral lead evidence check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Referral lead evidence check passed: accepted partner referrals can be reviewed before inbound lead recording.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
