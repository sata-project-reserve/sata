import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReferralHandoffResponseEvidenceDraft } from './lib/referral-handoff-response-evidence-parser.mjs';
import { renderReferralHandoffResponseEvidenceComment } from './referral-handoff-response-evidence-comment-agent.mjs';

const baseQueue = readJson(join('public', 'referral-partner-handoff-queue.json'));
const form = readFileSync(
  join('.github', 'ISSUE_TEMPLATE', 'referral-handoff-response-evidence.yml'),
  'utf8'
);
const workflow = readFileSync(
  join('.github', 'workflows', 'referral-handoff-response-evidence.yml'),
  'utf8'
);
const packageJson = readJson('package.json');
const agent = readFileSync(join('scripts', 'referral-partner-handoff-agent.mjs'), 'utf8');
const queue = {
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
      status: 'sent-awaiting-response',
      sentEvidence: 'https://x.com/example/status/109',
      sentAtUtc: '2026-09-10T12:00:00.000Z',
      messageHash: '',
      nextAction:
        'Record the partner response. If accepted, wait for a referred customer evidence record before invoice review.',
      boundary:
        'This handoff does not approve compensation, invoices, payment instructions, token grants, public posts, or asset movement.'
    }
  ]
};
const issue = {
  number: 110,
  html_url: 'https://github.com/sata-project-reserve/sata/issues/110',
  body:
    '### Referral handoff ID\nhandoff-diana-crypto-20260903-transparency-tweet\n\n### Partner accepted terms\ntrue\n\n### Response evidence URL or reference\nhttps://x.com/example/status/110\n\n### Exact response summary\nPartner replied yes and accepted the post-receipt referral terms. No compensation, invoice, payment instruction, token grant, public post, or asset movement was approved.\n\n### Responded at UTC\n2026-09-10T12:30:00.000Z\n'
};
const draft = buildReferralHandoffResponseEvidenceDraft({ issue, queue });
const comment = renderReferralHandoffResponseEvidenceComment(draft);
const findings = [];

if (!/referral-handoff-response-evidence/.test(form)) {
  findings.push('issue form must apply the referral-handoff-response-evidence label');
}
if (!/manual-evidence/.test(form)) {
  findings.push('issue form must apply the manual-evidence label');
}
for (const required of [
  /Referral handoff ID/,
  /Partner accepted terms/,
  /Response evidence URL or reference/,
  /Exact response summary/,
  /Responded at UTC/,
  /does not approve compensation/i
]) {
  if (!required.test(form)) findings.push(`issue form missing ${required}`);
}
if (!/id: respondedAtUtc[\s\S]*?required: true/.test(form)) {
  findings.push('issue form must require respondedAtUtc because record-response rejects missing timestamps');
}
if (/payment address|send payment|private key|seed phrase/i.test(form)) {
  findings.push('issue form must not request payments or wallet secrets');
}
if (
  packageJson.scripts?.['ops:referral-handoff-response-evidence-check'] !==
  'node scripts/validate-referral-handoff-response-evidence.mjs'
) {
  findings.push('package.json must expose ops:referral-handoff-response-evidence-check');
}
if (
  packageJson.scripts?.['ops:referral-handoff-response-evidence-plan'] !==
  'node scripts/referral-handoff-response-evidence-agent.mjs plan'
) {
  findings.push('package.json must expose ops:referral-handoff-response-evidence-plan');
}
if (!/respondedAtUtc: options.respondedAtUtc/.test(agent)) {
  findings.push('referral handoff agent must pass respondedAtUtc through to record-response');
}
if (!draft.readyToRecord) {
  findings.push(`fixture should be ready to record: ${draft.findings.join('; ')}`);
}
if (
  !/referral-partner-handoff-agent\.mjs record-response --handoff handoff-diana-crypto-20260903-transparency-tweet --accepted true/.test(
    draft.operatorCommand ?? ''
  )
) {
  findings.push('operator command must use referral handoff record-response command');
}
if (!/--evidence "https:\/\/x\.com\/example\/status\/110"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must use the submitted response evidence URL');
}
if (!/--respondedAtUtc "2026-09-10T12:30:00.000Z"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve respondedAtUtc when provided');
}
if (!/respondedAtUtc: options\.respondedAtUtc/.test(agent)) {
  findings.push('referral handoff agent must pass respondedAtUtc through to record-response');
}
if (!/does not approve .*compensation/i.test(draft.boundary ?? '')) {
  findings.push('draft boundary must block compensation approval');
}
if (!comment.includes('<!-- sata-referral-handoff-response-evidence-review -->')) {
  findings.push('comment must include stable marker');
}
if (!/No compensation, invoice, payment instruction/i.test(comment)) {
  findings.push('comment must preserve no-approval boundary');
}
if (!/Operator command/.test(comment)) {
  findings.push('comment must expose the operator command section');
}
for (const expected of [
  'referral-handoff-response-evidence',
  'ops:referral-handoff-response-evidence-check',
  'referral-handoff-response-evidence-comment-agent.mjs comment-from-event-json',
  '<!-- sata-referral-handoff-response-evidence-review -->'
]) {
  if (!workflow.includes(expected)) findings.push(`workflow missing ${expected}`);
}
if (/record-response|ops:approve|ops:reject|social:agent:post/.test(workflow)) {
  findings.push('workflow must not execute state-changing or external-publishing commands');
}

const staleQueueDraft = buildReferralHandoffResponseEvidenceDraft({
  issue,
  queue: {
    ...queue,
    handoffs: [{ ...queue.handoffs[0], status: 'accepted-awaiting-referred-lead' }]
  }
});
if (staleQueueDraft.readyToRecord) {
  findings.push('non-awaiting handoffs must not be ready to record a response');
}
if (!staleQueueDraft.findings.some((finding) => /not awaiting response/i.test(finding))) {
  findings.push('non-awaiting handoff must report status problem');
}

const unsafeIssue = {
  ...issue,
  body: issue.body.replace('Partner replied yes', 'Partner promised guaranteed buyers')
};
const unsafeDraft = buildReferralHandoffResponseEvidenceDraft({ issue: unsafeIssue, queue });
if (unsafeDraft.readyToRecord) {
  findings.push('unsafe response summary must not be ready to record');
}
if (!unsafeDraft.findings.some((finding) => /prohibited/i.test(finding))) {
  findings.push('unsafe response summary must report prohibited wording');
}

const missingTimestampIssue = {
  ...issue,
  body: issue.body.replace(/\n\n### Responded at UTC\n2026-09-10T12:30:00\.000Z\n/, '\n')
};
const missingTimestampDraft = buildReferralHandoffResponseEvidenceDraft({
  issue: missingTimestampIssue,
  queue
});
if (missingTimestampDraft.readyToRecord) {
  findings.push('missing respondedAtUtc issue must not be ready to record');
}
if (
  !missingTimestampDraft.findings.some((finding) =>
    /Missing required fields: respondedAtUtc/i.test(finding)
  )
) {
  findings.push('missing respondedAtUtc issue must report missing timestamp');
}

const malformedTimestampIssue = {
  ...issue,
  body: issue.body.replace(
    '### Responded at UTC\n2026-09-10T12:30:00.000Z',
    '### Responded at UTC\nnot-a-date'
  )
};
const malformedTimestampDraft = buildReferralHandoffResponseEvidenceDraft({
  issue: malformedTimestampIssue,
  queue
});
if (malformedTimestampDraft.readyToRecord) {
  findings.push('malformed respondedAtUtc issue must not be ready to record');
}
if (
  !malformedTimestampDraft.findings.some((finding) => /valid ISO timestamp/i.test(finding))
) {
  findings.push('malformed respondedAtUtc issue must report timestamp format error');
}

if (findings.length > 0) {
  console.error('Referral handoff response evidence check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Referral handoff response evidence check passed: partner responses can be reviewed without mutating state.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
