import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOutreachContactEvidenceDraft } from './lib/outreach-contact-evidence-parser.mjs';
import { renderOutreachContactEvidenceComment } from './outreach-contact-evidence-comment-agent.mjs';

const pipeline = readJson(join('public', 'sats-prospect-pipeline.json'));
const packetQueue = readJson(join('public', 'service-outreach-packet-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'outreach-contact-evidence-issue.json'));
const form = readFileSync(join('.github', 'ISSUE_TEMPLATE', 'outreach-contact-evidence.yml'), 'utf8');
const workflow = readOptionalText(join('.github', 'workflows', 'outreach-contact-evidence.yml'));
const evidenceAgent = readFileSync(join('scripts', 'outreach-contact-evidence-agent.mjs'), 'utf8');
const packageJson = readJson('package.json');
const draft = buildOutreachContactEvidenceDraft({ issue: issueFixture, packetQueue, pipeline });
const comment = renderOutreachContactEvidenceComment(draft);
const findings = [];

if (!/outreach-contact-evidence/.test(form)) {
  findings.push('issue form must apply the outreach-contact-evidence label');
}
if (!/manual-evidence/.test(form)) {
  findings.push('issue form must apply the manual-evidence label');
}
for (const required of [
  /Outreach packet ID/,
  /Prospect ID/,
  /Contact evidence URL or reference/,
  /Approved message SHA-256/,
  /Exact message sent/,
  /Sent at UTC/,
  /chairman-approved factual outreach copy/i,
  /does not approve an invoice/i
]) {
  if (!required.test(form)) findings.push(`issue form missing ${required}`);
}
if (!/id: sentAtUtc[\s\S]*?required: true/.test(form)) {
  findings.push('issue form must require sentAtUtc because mark-sent rejects missing timestamps');
}
if (/payment address|send payment|private key|seed phrase/i.test(form)) {
  findings.push('issue form must not request payments or wallet secrets');
}
if (packageJson.scripts?.['ops:outreach-contact-evidence-check'] !== 'node scripts/validate-outreach-contact-evidence.mjs') {
  findings.push('package.json must expose ops:outreach-contact-evidence-check');
}
if (packageJson.scripts?.['ops:outreach-contact-evidence-plan'] !== 'node scripts/outreach-contact-evidence-agent.mjs plan') {
  findings.push('package.json must expose ops:outreach-contact-evidence-plan');
}
if (!draft.readyToRecord) {
  findings.push(`fixture should be ready to record: ${draft.findings.join('; ')}`);
}
if (!draft.messageMatchesApprovedPacket) {
  findings.push('fixture message must match approved packet exactly');
}
if (!draft.hashMatchesApprovedPacket) {
  findings.push('fixture approved message SHA-256 must match approved packet');
}
if (!/service-outreach-packet-agent\.mjs mark-sent --packet outreach-packet-20260831-arnold-solana/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must use packet-aware mark-sent command');
}
if (!/--evidence "https:\/\/x\.com\/example\/status\/108"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must use the submitted contact evidence URL');
}
if (!/--sentAtUtc "2026-09-10T10:00:00.000Z"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve the submitted sentAtUtc timestamp');
}
if (!/--messageHash c370ebac72102e729a6fc7b1155afa2dbd8b8a07ba154fddca993a223d349ae8/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must include approved message SHA-256');
}
if (/sats-prospect-response-agent\.mjs record-contacted/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must not use stale prospect-only contacted command');
}
if (!/does not send outreach/i.test(draft.boundary ?? '')) {
  findings.push('draft boundary must say it does not send outreach');
}
if (!/does not .*move assets/i.test(draft.boundary ?? '')) {
  findings.push('draft boundary must prohibit asset movement');
}
if (!comment.includes('<!-- sata-outreach-contact-evidence-review -->')) {
  findings.push('comment must include stable marker');
}
if (!/No outreach, invoice, payment instruction/i.test(comment)) {
  findings.push('comment must preserve no-approval boundary');
}
if (!/Operator command/.test(comment)) {
  findings.push('comment must expose the operator command section');
}
if (!/Approved message SHA-256/.test(comment) || !/Hash matches approved packet: true/.test(comment)) {
  findings.push('comment must expose approved message hash match status');
}
if (!/approvedMessageSha256/.test(evidenceAgent) || !/approved SHA-256 match the packet/i.test(evidenceAgent)) {
  findings.push('evidence agent plan must expose the approved hash match requirement');
}

const mismatchedIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('Hi arnold-solana,', 'Hi altered-team,')
};
const mismatchedDraft = buildOutreachContactEvidenceDraft({
  issue: mismatchedIssue,
  packetQueue,
  pipeline
});
if (mismatchedDraft.readyToRecord) {
  findings.push('mismatched message must not be ready to record');
}
if (!mismatchedDraft.findings.some((finding) => /does not match/i.test(finding))) {
  findings.push('mismatched message must report exact-message mismatch');
}

const wrongProspectIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('### Prospect ID\narnold-solana', '### Prospect ID\nnpc-meme')
};
const wrongProspectDraft = buildOutreachContactEvidenceDraft({
  issue: wrongProspectIssue,
  packetQueue,
  pipeline
});
if (wrongProspectDraft.readyToRecord) {
  findings.push('wrong prospect issue must not be ready to record');
}
if (!wrongProspectDraft.findings.some((finding) => /Packet prospect mismatch/i.test(finding))) {
  findings.push('wrong prospect issue must report packet prospect mismatch');
}

const wrongHashIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    '### Approved message SHA-256\nc370ebac72102e729a6fc7b1155afa2dbd8b8a07ba154fddca993a223d349ae8',
    `### Approved message SHA-256\n${'0'.repeat(64)}`
  )
};
const wrongHashDraft = buildOutreachContactEvidenceDraft({
  issue: wrongHashIssue,
  packetQueue,
  pipeline
});
if (wrongHashDraft.readyToRecord) {
  findings.push('wrong approved message hash issue must not be ready to record');
}
if (!wrongHashDraft.findings.some((finding) => /SHA-256 does not match/i.test(finding))) {
  findings.push('wrong approved message hash issue must report hash mismatch');
}

const malformedHashIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    '### Approved message SHA-256\nc370ebac72102e729a6fc7b1155afa2dbd8b8a07ba154fddca993a223d349ae8',
    '### Approved message SHA-256\nnot-a-valid-hash'
  )
};
const malformedHashDraft = buildOutreachContactEvidenceDraft({
  issue: malformedHashIssue,
  packetQueue,
  pipeline
});
if (malformedHashDraft.readyToRecord) {
  findings.push('malformed approved message hash issue must not be ready to record');
}
if (!malformedHashDraft.findings.some((finding) => /64-character lowercase hex/i.test(finding))) {
  findings.push('malformed approved message hash issue must report format error');
}

const missingTimestampIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(/\n\n### Sent at UTC\n2026-09-10T10:00:00\.000Z\n/, '\n')
};
const missingTimestampDraft = buildOutreachContactEvidenceDraft({
  issue: missingTimestampIssue,
  packetQueue,
  pipeline
});
if (missingTimestampDraft.readyToRecord) {
  findings.push('missing sentAtUtc issue must not be ready to record');
}
if (
  !missingTimestampDraft.findings.some((finding) =>
    /Missing required fields: sentAtUtc/i.test(finding)
  )
) {
  findings.push('missing sentAtUtc issue must report missing timestamp');
}

const malformedTimestampIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    '### Sent at UTC\n2026-09-10T10:00:00.000Z',
    '### Sent at UTC\nnot-a-date'
  )
};
const malformedTimestampDraft = buildOutreachContactEvidenceDraft({
  issue: malformedTimestampIssue,
  packetQueue,
  pipeline
});
if (malformedTimestampDraft.readyToRecord) {
  findings.push('malformed sentAtUtc issue must not be ready to record');
}
if (!malformedTimestampDraft.findings.some((finding) => /valid ISO timestamp/i.test(finding))) {
  findings.push('malformed sentAtUtc issue must report timestamp format error');
}

if (workflow) {
  for (const expected of [
    'outreach-contact-evidence',
    'ops:outreach-contact-evidence-check',
    'outreach-contact-evidence-comment-agent.mjs comment-from-event-json',
    '<!-- sata-outreach-contact-evidence-review -->'
  ]) {
    if (!workflow.includes(expected)) findings.push(`workflow missing ${expected}`);
  }
  if (/mark-sent|ops:approve|ops:reject|social:agent:post/.test(workflow)) {
    findings.push('workflow must not execute state-changing or external-publishing commands');
  }
}

if (findings.length > 0) {
  console.error('Outreach contact evidence check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Outreach contact evidence check passed: manual send evidence can be reviewed without mutating state.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
