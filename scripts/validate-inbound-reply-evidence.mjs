import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildInboundReplyEvidenceDraft } from './lib/inbound-reply-evidence-parser.mjs';
import { renderInboundReplyEvidenceIssueBody } from './inbound-reply-evidence-agent.mjs';
import { renderInboundReplyEvidenceComment } from './inbound-reply-evidence-comment-agent.mjs';

const queue = readJson(join('public', 'inbound-service-lead-queue.json'));
const invoiceQueue = readJson(join('public', 'sats-invoice-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'inbound-reply-evidence-issue.json'));
const form = readFileSync(join('.github', 'ISSUE_TEMPLATE', 'inbound-reply-evidence.yml'), 'utf8');
const workflow = readFileSync(join('.github', 'workflows', 'inbound-reply-evidence.yml'), 'utf8');
const packageJson = readJson('package.json');
const agent = readFileSync(join('scripts', 'inbound-reply-evidence-agent.mjs'), 'utf8');
const commentAgent = readFileSync(join('scripts', 'inbound-reply-evidence-comment-agent.mjs'), 'utf8');
const findings = [];

const draft = buildInboundReplyEvidenceDraft({ issue: issueFixture, queue });
const comment = renderInboundReplyEvidenceComment(draft);
const renderedTemplate = renderInboundReplyEvidenceIssueBody({
  sourceType: 'paid-promotion-reply',
  sourceId: 'diana-crypto-20260903-transparency-tweet',
  contactHandle: 'example-buyer',
  publicProfileUrl: 'https://x.com/example_buyer',
  projectUrl: 'https://example.invalid',
  requestedOfferId: 'transparency-audit',
  exactReplyText: 'Looks good. What is the payment method and can you send the invoice?',
  replyEvidenceUrl: 'https://x.com/example_buyer/status/123456789',
  recordedAtUtc: '2026-09-10T15:00:00.000Z',
  classification: 'invoice-request-needs-chairman-review',
  customerAskedForInvoice: true
});

if (!/inbound-reply-evidence/.test(form)) {
  findings.push('issue form must apply the inbound-reply-evidence label');
}
if (!/manual-evidence/.test(form)) {
  findings.push('issue form must apply the manual-evidence label');
}
for (const required of [
  /Source type/,
  /Source ID/,
  /Contact handle/,
  /Public profile URL/,
  /Project URL/,
  /Requested offer ID/,
  /Exact reply text/,
  /Reply evidence URL or reference/,
  /Recorded at UTC/,
  /Classification/,
  /Customer asked for invoice/,
  /does not approve invoices/i,
  /Executive Chairman approval/i
]) {
  if (!required.test(form)) findings.push(`issue form missing ${required}`);
}
if (/private key|seed phrase/i.test(form)) {
  findings.push('issue form must not request wallet secrets');
}
if (/label:\s*(Payment address|Send payment|Reserve address)/i.test(form)) {
  findings.push('issue form must not ask for payment address or payment-send fields');
}
if (
  packageJson.scripts?.['ops:inbound-reply-evidence-check'] !==
  'node scripts/validate-inbound-reply-evidence.mjs'
) {
  findings.push('package.json must expose ops:inbound-reply-evidence-check');
}
if (
  packageJson.scripts?.['ops:inbound-reply-evidence-plan'] !==
  'node scripts/inbound-reply-evidence-agent.mjs plan'
) {
  findings.push('package.json must expose ops:inbound-reply-evidence-plan');
}
if (!draft.readyToRecord) {
  findings.push(`fixture should be ready to record: ${draft.findings.join('; ')}`);
}
if (draft.triage?.classification !== 'invoice-request-needs-chairman-review') {
  findings.push('fixture must classify as invoice-request-needs-chairman-review');
}
if (draft.triage?.customerAskedForInvoice !== true) {
  findings.push('fixture must preserve customerAskedForInvoice true');
}
if (!/inbound-service-lead-agent\.mjs record-lead/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must record the inbound lead');
}
if (!/--customerAskedForInvoice true/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve customerAskedForInvoice true');
}
if (!/--recordedAtUtc "2026-09-10T15:00:00.000Z"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve recordedAtUtc');
}
if (!/inbound-invoice-request-agent\.mjs render --lead "example-buyer"/.test(draft.triage?.nextCommandAfterRecord ?? '')) {
  findings.push('invoice-request evidence must route to inbound invoice request packet rendering');
}
if (JSON.stringify(draft).includes(invoiceQueue.paymentPolicy.reserveAddress)) {
  findings.push('inbound reply evidence draft must not expose the reserve payment address');
}
if (!comment.includes('<!-- sata-inbound-reply-evidence-review -->')) {
  findings.push('comment must include stable marker');
}
if (!/No invoice, payment instruction/i.test(comment)) {
  findings.push('comment must preserve no-approval boundary');
}
if (!/Suggested reply/.test(comment)) {
  findings.push('comment must include suggested reply');
}
if (!/Operator command/.test(comment)) {
  findings.push('comment must expose the operator command section');
}
if (comment.includes(invoiceQueue.paymentPolicy.reserveAddress)) {
  findings.push('comment must not expose the reserve payment address');
}
if (!/draft-from-issue-json/.test(agent)) {
  findings.push('agent must expose draft-from-issue-json');
}
if (!/render-template/.test(agent)) {
  findings.push('agent must expose render-template');
}
if (!renderedTemplate.includes('### Source type\npaid-promotion-reply')) {
  findings.push('rendered template must include source type');
}
if (!renderedTemplate.includes('### Source ID\ndiana-crypto-20260903-transparency-tweet')) {
  findings.push('rendered template must include source id');
}
if (!renderedTemplate.includes('### Exact reply text\nLooks good. What is the payment method and can you send the invoice?')) {
  findings.push('rendered template must include exact reply text');
}
if (!renderedTemplate.includes('### Classification\ninvoice-request-needs-chairman-review')) {
  findings.push('rendered template must include classification');
}
if (!renderedTemplate.includes('### Customer asked for invoice\ntrue')) {
  findings.push('rendered template must include invoice-request flag');
}
if (!/comment-from-event-json/.test(commentAgent)) {
  findings.push('comment agent must expose comment-from-event-json');
}
for (const expected of [
  'inbound-reply-evidence',
  'ops:inbound-reply-evidence-check',
  'inbound-reply-evidence-comment-agent.mjs comment-from-event-json',
  '<!-- sata-inbound-reply-evidence-review -->'
]) {
  if (!workflow.includes(expected)) findings.push(`workflow missing ${expected}`);
}
if (/record-lead|ops:approve|ops:reject|social:agent:post/.test(workflow)) {
  findings.push('workflow must not execute state-changing or external-publishing commands');
}

const mismatchIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    '### Classification\ninvoice-request-needs-chairman-review',
    '### Classification\nneeds-intake-fields'
  )
};
const mismatchDraft = buildInboundReplyEvidenceDraft({ issue: mismatchIssue, queue });
if (mismatchDraft.readyToRecord) {
  findings.push('classification mismatch must not be ready to record');
}
if (!mismatchDraft.findings.some((finding) => /Classification mismatch/i.test(finding))) {
  findings.push('classification mismatch must report a classification finding');
}

const intakeIssue = {
  ...issueFixture,
  body: issueFixture.body
    .replace(
      'Looks good. What is the payment method and can you send the invoice?',
      'I am interested in the transparency audit. What do you need from us?'
    )
    .replace(
      '### Classification\ninvoice-request-needs-chairman-review',
      '### Classification\nneeds-intake-fields'
    )
    .replace('### Customer asked for invoice\ntrue', '### Customer asked for invoice\nfalse')
};
const intakeDraft = buildInboundReplyEvidenceDraft({ issue: intakeIssue, queue });
if (!intakeDraft.readyToRecord) {
  findings.push(`service-interest reply should be ready to record as intake: ${intakeDraft.findings.join('; ')}`);
}
if (/--customerAskedForInvoice true/.test(intakeDraft.operatorCommand ?? '')) {
  findings.push('service-interest reply must not become an invoice request');
}

const rejectedIssue = {
  ...issueFixture,
  body: issueFixture.body
    .replace(
      'Looks good. What is the payment method and can you send the invoice?',
      'Can you bring guaranteed buyers and fake engagement?'
    )
    .replace(
      '### Classification\ninvoice-request-needs-chairman-review',
      '### Classification\nreject-prohibited-promotion'
    )
    .replace('### Customer asked for invoice\ntrue', '### Customer asked for invoice\nfalse')
};
const rejectedDraft = buildInboundReplyEvidenceDraft({ issue: rejectedIssue, queue });
if (rejectedDraft.readyToRecord) {
  findings.push('prohibited promotional reply must not be ready to record');
}
if (!rejectedDraft.findings.some((finding) => /prohibited/i.test(finding))) {
  findings.push('prohibited promotional reply must report prohibited wording');
}

const badTimestampIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('### Recorded at UTC\n2026-09-10T15:00:00.000Z', '### Recorded at UTC\nnot-a-date')
};
const badTimestampDraft = buildInboundReplyEvidenceDraft({ issue: badTimestampIssue, queue });
if (badTimestampDraft.readyToRecord) {
  findings.push('bad recordedAtUtc issue must not be ready to record');
}
if (!badTimestampDraft.findings.some((finding) => /valid ISO timestamp/i.test(finding))) {
  findings.push('bad recordedAtUtc issue must report timestamp problem');
}

if (findings.length > 0) {
  console.error('Inbound reply evidence check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Inbound reply evidence check passed: reply evidence can be reviewed before lead recording or invoice review.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
