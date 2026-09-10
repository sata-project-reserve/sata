import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSocialPublishEvidenceDraft } from './lib/social-publish-evidence-parser.mjs';
import { renderSocialPublishEvidenceComment } from './social-publish-evidence-comment-agent.mjs';

const socialQueue = readJson(join('public', 'social-agent-content-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'social-publish-evidence-issue.json'));
const form = readFileSync(join('.github', 'ISSUE_TEMPLATE', 'social-publish-evidence.yml'), 'utf8');
const workflow = readFileSync(join('.github', 'workflows', 'social-publish-evidence.yml'), 'utf8');
const evidenceAgent = readFileSync(join('scripts', 'social-publish-evidence-agent.mjs'), 'utf8');
const commentAgent = readFileSync(join('scripts', 'social-publish-evidence-comment-agent.mjs'), 'utf8');
const socialAgent = readFileSync(join('scripts', 'x-social-agent.mjs'), 'utf8');
const packageJson = readJson('package.json');
const draft = buildSocialPublishEvidenceDraft({ issue: issueFixture, socialQueue });
const comment = renderSocialPublishEvidenceComment(draft);
const findings = [];

for (const required of [
  /social-publish-evidence/,
  /manual-evidence/,
  /Social post ID/,
  /Published post URL/,
  /Publication evidence URL or reference/,
  /Approved content SHA-256/,
  /Exact post text published/,
  /Published at UTC/,
  /does not approve posts/i
]) {
  if (!required.test(form)) findings.push(`issue form missing ${required}`);
}
if (/payment address|send payment to|private key|seed phrase|wallet secret/i.test(form)) {
  findings.push('issue form must not request payments or wallet secrets');
}
if (packageJson.scripts?.['ops:social-publish-evidence-check'] !== 'node scripts/validate-social-publish-evidence.mjs') {
  findings.push('package.json must expose ops:social-publish-evidence-check');
}
if (packageJson.scripts?.['ops:social-publish-evidence-plan'] !== 'node scripts/social-publish-evidence-agent.mjs plan') {
  findings.push('package.json must expose ops:social-publish-evidence-plan');
}
if (!draft.readyToRecord) {
  findings.push(`fixture should be ready to record: ${draft.findings.join('; ')}`);
}
if (!draft.textMatchesApprovedPost) {
  findings.push('fixture exact text must match approved social post');
}
if (!draft.hashMatchesApprovedPost) {
  findings.push('fixture approved content hash must match approved social post');
}
if (!/social:agent -- record-published --post btc-reserve-first-tranche/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must record the approved social post as published');
}
if (!/--publishedAtUtc "2026-09-10T13:00:00.000Z"/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must preserve publishedAtUtc');
}
if (!/--contentHash 4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e/.test(draft.operatorCommand ?? '')) {
  findings.push('operator command must include approved content hash');
}
if (!/contentHash does not match the approved post text/.test(socialAgent)) {
  findings.push('x-social-agent must reject mismatched contentHash');
}
if (!/publishedAtUtc: options\.publishedAtUtc/.test(socialAgent)) {
  findings.push('x-social-agent must pass publishedAtUtc into publication recording');
}
if (/publishedAtUtc = new Date\(\)\.toISOString\(\)/.test(socialAgent)) {
  findings.push('manual publication recording must not default publishedAtUtc to runtime now');
}
if (!/does not publish posts/i.test(draft.boundary ?? '')) {
  findings.push('draft boundary must say it does not publish posts');
}
if (!comment.includes('<!-- sata-social-publish-evidence-review -->')) {
  findings.push('comment must include stable marker');
}
if (!/No post, invoice, payment instruction/i.test(comment)) {
  findings.push('comment must preserve no-approval boundary');
}
if (!/Operator command/.test(comment)) {
  findings.push('comment must expose the operator command section');
}
if (!/Approved content SHA-256/.test(comment) || !/Hash matches approved post: true/.test(comment)) {
  findings.push('comment must expose approved content hash match status');
}
if (!/approved SHA-256 match the queue/i.test(evidenceAgent)) {
  findings.push('evidence agent plan must mention the approved hash match requirement');
}
if (!/renderSocialPublishEvidenceComment/.test(commentAgent)) {
  findings.push('comment agent must export the renderer for validation');
}
for (const expected of [
  'social-publish-evidence',
  'ops:social-publish-evidence-check',
  'social-publish-evidence-comment-agent.mjs comment-from-event-json',
  '<!-- sata-social-publish-evidence-review -->'
]) {
  if (!workflow.includes(expected)) findings.push(`workflow missing ${expected}`);
}
if (/record-published|ops:approve|ops:reject|social:agent:post|post-next-approved/.test(workflow)) {
  findings.push('workflow must not execute state-changing or external-publishing commands');
}

const alteredTextIssue = {
  ...issueFixture,
  body: issueFixture.body.replace('Current first tranche: 500,000 sats.', 'Current first tranche: 1,000,000 sats.')
};
const alteredTextDraft = buildSocialPublishEvidenceDraft({ issue: alteredTextIssue, socialQueue });
if (alteredTextDraft.readyToRecord) {
  findings.push('altered post text must not be ready to record');
}
if (!alteredTextDraft.findings.some((finding) => /does not match/i.test(finding))) {
  findings.push('altered post text must report exact text mismatch');
}

const wrongHashIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    '### Approved content SHA-256\n4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e',
    `### Approved content SHA-256\n${'0'.repeat(64)}`
  )
};
const wrongHashDraft = buildSocialPublishEvidenceDraft({ issue: wrongHashIssue, socialQueue });
if (wrongHashDraft.readyToRecord) {
  findings.push('wrong approved content hash issue must not be ready to record');
}
if (!wrongHashDraft.findings.some((finding) => /SHA-256 does not match/i.test(finding))) {
  findings.push('wrong approved content hash issue must report hash mismatch');
}

const wrongUrlIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    'https://x.com/SATAReserve/status/2085000000000000000',
    'https://x.com/wrong/status/2085000000000000000'
  )
};
const wrongUrlDraft = buildSocialPublishEvidenceDraft({ issue: wrongUrlIssue, socialQueue });
if (wrongUrlDraft.readyToRecord) {
  findings.push('wrong post URL issue must not be ready to record');
}
if (!wrongUrlDraft.findings.some((finding) => /Published post URL must match/i.test(finding))) {
  findings.push('wrong post URL issue must report canonical URL mismatch');
}

if (findings.length > 0) {
  console.error('Social publish evidence check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Social publish evidence check passed: manual social publication evidence is reviewable and hash-bound.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
