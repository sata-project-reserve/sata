import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCollaboratorMeetingIntakeDraft } from './lib/collaborator-meeting-intake-parser.mjs';
import { renderCollaboratorMeetingIntakeComment } from './collaborator-meeting-intake-comment-agent.mjs';

const policy = readJson(join('public', 'collaborator-meeting-intake.json'));
const queue = readJson(join('public', 'executive-approval-queue.json'));
const issueFixture = readJson(join('tests', 'fixtures', 'collaborator-meeting-intake-issue.json'));
const form = readFileSync(
  join('.github', 'ISSUE_TEMPLATE', 'collaborator-meeting-intake.yml'),
  'utf8'
);
const workflow = readFileSync(
  join('.github', 'workflows', 'collaborator-meeting-intake.yml'),
  'utf8'
);
const intakeAgent = readFileSync(join('scripts', 'collaborator-meeting-intake-agent.mjs'), 'utf8');
const commentAgent = readFileSync(
  join('scripts', 'collaborator-meeting-intake-comment-agent.mjs'),
  'utf8'
);
const referralPage = readFileSync(join('app', 'partners', 'referrals', 'page.tsx'), 'utf8');
const packageJson = readJson('package.json');
const draft = buildCollaboratorMeetingIntakeDraft({ issue: issueFixture, policy });
const comment = renderCollaboratorMeetingIntakeComment(draft);
const findings = [];

if (policy.schemaVersion !== 1) findings.push('schemaVersion must be 1');
if (policy.mode !== 'collaborator-meeting-intake-policy') {
  findings.push('mode must be collaborator-meeting-intake-policy');
}
if (!['pending-executive-chairman-approval', 'approved-by-chairman'].includes(policy.status)) {
  findings.push('status must be pending or approved by chairman');
}
if (!/Dubai, UAE/i.test(policy.locationScope?.primaryLocation ?? '')) {
  findings.push('locationScope.primaryLocation must identify Dubai, UAE');
}
if (!/Public venue only/i.test(policy.locationScope?.meetingVenueRule ?? '')) {
  findings.push('meetingVenueRule must require a public venue');
}
if (!/No custody handoff/i.test(policy.locationScope?.meetingVenueRule ?? '')) {
  findings.push('meetingVenueRule must prohibit custody handoff');
}
for (const required of [
  /Real identity or durable professional profile/i,
  /Examples of past work/i,
  /Disclosure policy/i,
  /willing to meet in person in Dubai/i
]) {
  if (!(policy.requiredSubmission ?? []).some((item) => required.test(item))) {
    findings.push(`requiredSubmission missing ${required}`);
  }
}
for (const required of [
  /Executive Chairman approval is required before any meeting/i,
  /partner-specific compensation proposal/i,
  /public post, invoice, payment instruction, token grant/i,
  /post-receipt evidence/i
]) {
  if (!(policy.approvalGates ?? []).some((item) => required.test(item))) {
    findings.push(`approvalGates missing ${required}`);
  }
}
for (const required of [
  /No private-key, seed phrase, or wallet custody exchange/i,
  /No cash or asset exchange/i,
  /No token grant promise/i,
  /No price, buyer, return, liquidity, volume, or market-support promise/i,
  /No pump language, fake engagement, bots, raids, or coordinated trading/i
]) {
  if (!(policy.prohibitedMeetingActivity ?? []).some((item) => required.test(item))) {
    findings.push(`prohibitedMeetingActivity missing ${required}`);
  }
}
if (!/issues\/new\?template=collaborator-meeting-intake\.yml/.test(policy.issueIntakeUrl ?? '')) {
  findings.push('issueIntakeUrl must point to collaborator meeting intake issue template');
}
if (!/does not approve any collaborator/i.test(policy.boundary ?? '')) {
  findings.push('boundary must state the policy approves no collaborator');
}
if (!/does not approve compensation/i.test(policy.replyTemplate ?? '')) {
  findings.push('replyTemplate must preserve no-compensation approval boundary');
}
if (
  !/No price guarantee, no redemption promise, no market-support commitment/i.test(
    policy.publicDisclosure ?? ''
  )
) {
  findings.push('publicDisclosure must include market and reserve caveats');
}
if (
  packageJson.scripts?.['ops:collaborator-meeting-check'] !==
  'node scripts/validate-collaborator-meeting-intake.mjs'
) {
  findings.push('package.json must expose ops:collaborator-meeting-check');
}
if (
  packageJson.scripts?.['ops:collaborator-meeting-plan'] !==
  'node scripts/collaborator-meeting-intake-agent.mjs plan'
) {
  findings.push('package.json must expose ops:collaborator-meeting-plan');
}
for (const expected of [
  'Collaborator Meeting Intake',
  'collaborator-meeting-intake',
  'Willing to meet face-to-face in Dubai',
  'does not approve a meeting',
  'must be in a public place',
  'private keys',
  'seed phrases'
]) {
  if (!form.includes(expected)) findings.push(`issue template missing ${expected}`);
}
if (
  /payment address|send payment to|private key value|seed phrase value|wallet secret value/i.test(
    form
  )
) {
  findings.push('issue template must not request payments or wallet secrets');
}
for (const expected of [
  'collaboratorMeetingIntake',
  'Face-To-Face Review',
  'Request Meeting Review',
  'collaboratorMeetingIntake.locationScope.primaryLocation',
  'collaboratorMeetingIntake.boundary'
]) {
  if (!referralPage.includes(expected)) findings.push(`/partners/referrals missing ${expected}`);
}

const approvalItem = (queue.items ?? []).find((item) => item.id === policy.approvalItemId);
if (!approvalItem) {
  findings.push(`approval queue missing ${policy.approvalItemId}`);
} else {
  if (approvalItem.category !== 'partnership') {
    findings.push(`${policy.approvalItemId}: category must be partnership`);
  }
  if (
    approvalItem.status !== 'ready-for-chairman-review' &&
    policy.status === 'pending-executive-chairman-approval'
  ) {
    findings.push(
      `${policy.approvalItemId}: pending policy requires ready-for-chairman-review approval item`
    );
  }
  if (approvalItem.requiredChairmanApproval !== true) {
    findings.push(`${policy.approvalItemId}: must require chairman approval`);
  }
  if (!/does not approve a meeting/i.test(approvalItem.proposedAction ?? '')) {
    findings.push(
      `${policy.approvalItemId}: proposedAction must preserve no-meeting approval boundary`
    );
  }
}

if (!draft.readyForChairmanReview) {
  findings.push(`fixture should be ready for chairman review: ${draft.findings.join('; ')}`);
}
if (draft.readyForScheduling) {
  findings.push('fixture must not be ready for scheduling before policy approval');
}
if (!draft.meetingRequested) {
  findings.push('fixture must identify Dubai public-place meeting request');
}
if (!/does not approve a collaborator/i.test(draft.boundary ?? '')) {
  findings.push('draft boundary must say it approves no collaborator');
}
if (!comment.includes('<!-- sata-collaborator-meeting-intake-review -->')) {
  findings.push('comment must include stable marker');
}
if (!/No meeting, partnership, compensation/i.test(comment)) {
  findings.push('comment must preserve no-approval boundary');
}
if (!/Ready for scheduling: false/.test(comment)) {
  findings.push('comment must show scheduling is not ready while policy is pending');
}
if (!/no execution command/i.test(comment)) {
  findings.push('comment must state no execution command is prepared');
}
if (!/draft-from-issue-json/.test(intakeAgent)) {
  findings.push('intake agent must support draft-from-issue-json');
}
if (!/renderCollaboratorMeetingIntakeComment/.test(commentAgent)) {
  findings.push('comment agent must export renderer for validation');
}
for (const expected of [
  'collaborator-meeting-intake',
  'ops:collaborator-meeting-check',
  'collaborator-meeting-intake-comment-agent.mjs comment-from-event-json',
  '<!-- sata-collaborator-meeting-intake-review -->'
]) {
  if (!workflow.includes(expected)) findings.push(`workflow missing ${expected}`);
}
if (
  /ops:approve|ops:reject|record-sent|mark-sent|invoice-payment|social:agent:post|post-next-approved/.test(
    workflow
  )
) {
  findings.push('workflow must not execute state-changing or external-publishing commands');
}

const missingDisclosureIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    'Sponsored/Paid Partnership or token-compensated referral relationship before any compensated coverage or referral activity.',
    'I will decide later.'
  )
};
const missingDisclosureDraft = buildCollaboratorMeetingIntakeDraft({
  issue: missingDisclosureIssue,
  policy
});
if (missingDisclosureDraft.readyForChairmanReview) {
  findings.push('missing disclosure policy issue must not be ready for chairman review');
}
if (!missingDisclosureDraft.findings.some((finding) => /Disclosure policy/i.test(finding))) {
  findings.push('missing disclosure policy issue must report disclosure finding');
}

const unsafeIssue = {
  ...issueFixture,
  body: issueFixture.body.replace(
    'Post-receipt referral share or separately approved factual media coverage. No upfront payment, no buyer claims, no fake engagement, no bots, no raids, and no market-support promises.',
    'I can deliver guaranteed buyers and market-support.'
  )
};
const unsafeDraft = buildCollaboratorMeetingIntakeDraft({ issue: unsafeIssue, policy });
if (unsafeDraft.readyForChairmanReview) {
  findings.push('unsafe collaborator issue must not be ready for chairman review');
}
if (!unsafeDraft.findings.some((finding) => /prohibited market/i.test(finding))) {
  findings.push('unsafe collaborator issue must report prohibited market wording');
}

const positiveClaimText = JSON.stringify(policy)
  .replace(
    /\bno [^"]*(?:price|buyer|return|liquidity|volume|market-support|fake engagement|bots|raids|pump language|coordinated trading)[^"]*/gi,
    ''
  )
  .replace(/\bnot [^"]*(?:approve|authorized|useful)[^"]*/gi, '')
  .replace(
    /\breject [^"]*(?:price|buyer|return|liquidity|volume|market-support|fake engagement|bots|raids|pump language|coordinated trading)[^"]*/gi,
    ''
  );
if (
  /\b(guaranteed buyers|price claims|return claims|market-support promise|coordinated trading)\b/i.test(
    positiveClaimText
  )
) {
  findings.push('policy contains unsafe market wording outside negative controls');
}

if (findings.length > 0) {
  console.error('Collaborator meeting intake check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Collaborator meeting intake check passed: face-to-face collaborator review stays chairman-gated.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
