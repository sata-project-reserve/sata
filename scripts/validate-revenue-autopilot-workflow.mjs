import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflow = readFileSync(join('.github', 'workflows', 'revenue-autopilot.yml'), 'utf8');
const ciWorkflow = readFileSync(join('.github', 'workflows', 'ci.yml'), 'utf8');
const transparencyWorkflow = readFileSync(
  join('.github', 'workflows', 'transparency-report.yml'),
  'utf8'
);
const governanceDoc = readFileSync(join('docs', 'autonomous-ops-governance.md'), 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const findings = [];

if (!/"ops:approval-followthrough-write"/.test(JSON.stringify(packageJson.scripts ?? {}))) {
  findings.push('package.json must expose ops:approval-followthrough-write');
}
if (!/workflow_dispatch:/.test(workflow)) {
  findings.push('revenue autopilot must be manually runnable');
}
if (!/schedule:/.test(workflow)) {
  findings.push('revenue autopilot must have a schedule');
}
if (!/contents:\s*write/.test(workflow)) {
  findings.push('revenue autopilot needs contents: write to commit approved follow-through state');
}
for (const requiredCommand of [
  'npm run ops:approval-followthrough-write',
  'npm run ops:cycle-write',
  'npm run ops:outreach-dispatch-write',
  'npm run ops:execution-brief-write',
  'npm run ops:reply-conversion-write',
  'npm run ops:referral-handoff-dispatch-write',
  'npm run ops:social-dispatch-write',
  'npm run ops:settlement-options-write',
  'npm run ops:sats-target-write',
  'npm run ops:check',
  'npm run ops:approval-plan-check',
  'npm run ops:approval-followthrough-check',
  'npm run ops:prospect-check',
  'npm run ops:prospect-follow-up-check',
  'npm run ops:outreach-approval-check',
  'npm run ops:outreach-check',
  'npm run ops:outreach-contact-evidence-check',
  'npm run ops:social-publish-evidence-check',
  'npm run ops:social-dispatch-check',
  'npm run ops:referral-handoff-evidence-check',
  'npm run ops:referral-handoff-response-evidence-check',
  'npm run ops:referral-handoff-dispatch-check',
  'npm run ops:outreach-dispatch-check',
  'npm run ops:paid-promotion-check',
  'npm run ops:cycle-check',
  'npm run ops:reply-conversion-check'
]) {
  if (!workflow.includes(requiredCommand)) {
    findings.push(`revenue autopilot must run ${requiredCommand}`);
  }
}
for (const [before, after] of [
  ['npm run ops:cycle-write', 'npm run ops:outreach-dispatch-write'],
  ['npm run ops:cycle-write', 'npm run ops:execution-brief-write'],
  ['npm run ops:cycle-write', 'npm run ops:reply-conversion-write'],
  ['npm run ops:cycle-write', 'npm run ops:referral-handoff-dispatch-write'],
  ['npm run ops:cycle-write', 'npm run ops:social-dispatch-write'],
  ['npm run ops:cycle-write', 'npm run ops:settlement-options-write'],
  ['npm run ops:cycle-write', 'npm run ops:sats-target-write'],
  ['npm run ops:outreach-dispatch-write', 'npm run ops:outreach-dispatch-check'],
  ['npm run ops:execution-brief-write', 'npm run ops:execution-brief-check'],
  ['npm run ops:reply-conversion-write', 'npm run ops:reply-conversion-check'],
  ['npm run ops:referral-handoff-dispatch-write', 'npm run ops:referral-handoff-dispatch-check'],
  ['npm run ops:social-dispatch-write', 'npm run ops:social-dispatch-check'],
  ['npm run ops:settlement-options-write', 'npm run ops:settlement-options-check'],
  ['npm run ops:sats-target-write', 'npm run ops:sats-target-check']
]) {
  const beforeIndex = workflow.indexOf(before);
  const afterIndex = workflow.indexOf(after);
  if (beforeIndex === -1 || afterIndex === -1 || beforeIndex >= afterIndex) {
    findings.push(`revenue autopilot must run ${before} before ${after}`);
  }
}
for (const forbiddenCommand of [
  'npm run ops:approve',
  'npm run ops:reject',
  'npm run social:agent:post',
  'post-next-approved',
  'mark-sent',
  'write-approved',
  'invoice-payment',
  'receipt',
  'reserve-draft-next-tranche'
]) {
  if (workflow.includes(forbiddenCommand)) {
    findings.push(`revenue autopilot must not run ${forbiddenCommand}`);
  }
}
if (!/public\/service-outreach-packet-queue\.json/.test(workflow)) {
  findings.push('revenue autopilot must commit generated service outreach packet queue state');
}
for (const generatedArtifact of [
  'public/revenue-execution-brief.json',
  'public/revenue-execution-brief.md',
  'public/outreach-dispatch-brief.json',
  'public/outreach-dispatch-brief.md',
  'public/reply-conversion-brief.json',
  'public/reply-conversion-brief.md',
  'public/referral-handoff-dispatch-brief.json',
  'public/referral-handoff-dispatch-brief.md',
  'public/social-dispatch-brief.json',
  'public/social-dispatch-brief.md',
  'public/settlement-options-brief.json',
  'public/settlement-options-brief.md',
  'public/sats-target-plan.json',
  'public/sats-target-plan.md'
]) {
  if (!workflow.includes(generatedArtifact)) {
    findings.push(`revenue autopilot must commit ${generatedArtifact}`);
  }
}
for (const requiredCommand of [
  'npm run ops:cycle-write',
  'npm run ops:outreach-dispatch-write',
  'npm run ops:execution-brief-write',
  'npm run ops:reply-conversion-write',
  'npm run ops:referral-handoff-dispatch-write',
  'npm run ops:social-dispatch-write',
  'npm run ops:settlement-options-write',
  'npm run ops:cycle-check',
  'npm run ops:social-publish-evidence-check',
  'npm run ops:social-dispatch-check',
  'npm run ops:outreach-dispatch-check',
  'npm run ops:execution-brief-check',
  'npm run ops:reply-conversion-check',
  'npm run ops:referral-handoff-evidence-check',
  'npm run ops:referral-handoff-response-evidence-check',
  'npm run ops:referral-handoff-dispatch-check',
  'npm run ops:settlement-options-check'
]) {
  if (!transparencyWorkflow.includes(requiredCommand)) {
    findings.push(`transparency publisher must run ${requiredCommand}`);
  }
}
for (const requiredCommand of [
  'npm run ops:social-publish-evidence-check',
  'npm run ops:social-dispatch-check',
  'npm run ops:settlement-options-check',
  'npm run ops:collaborator-meeting-check',
  'npm run social:check'
]) {
  if (!ciWorkflow.includes(requiredCommand)) {
    findings.push(`CI must run ${requiredCommand}`);
  }
}
for (const requiredPath of [
  '.github/workflows/social-publish-evidence.yml',
  '.github/workflows/collaborator-meeting-intake.yml',
  '.github/ISSUE_TEMPLATE/social-publish-evidence.yml',
  '.github/ISSUE_TEMPLATE/collaborator-meeting-intake.yml',
  'public/collaborator-meeting-intake.json',
  'tests/fixtures/social-publish-evidence-issue.json',
  'tests/fixtures/collaborator-meeting-intake-issue.json'
]) {
  if (!transparencyWorkflow.includes(requiredPath)) {
    findings.push(`transparency publisher path filters must include ${requiredPath}`);
  }
}
for (const [before, after] of [
  ['npm run ops:cycle-write', 'npm run ops:outreach-dispatch-write'],
  ['npm run ops:cycle-write', 'npm run ops:execution-brief-write'],
  ['npm run ops:cycle-write', 'npm run ops:reply-conversion-write'],
  ['npm run ops:cycle-write', 'npm run ops:referral-handoff-dispatch-write'],
  ['npm run ops:cycle-write', 'npm run ops:social-dispatch-write'],
  ['npm run ops:cycle-write', 'npm run ops:settlement-options-write'],
  ['npm run ops:outreach-dispatch-write', 'npm run ops:outreach-dispatch-check'],
  ['npm run ops:execution-brief-write', 'npm run ops:execution-brief-check'],
  ['npm run ops:reply-conversion-write', 'npm run ops:reply-conversion-check'],
  ['npm run ops:referral-handoff-dispatch-write', 'npm run ops:referral-handoff-dispatch-check'],
  ['npm run ops:social-dispatch-write', 'npm run ops:social-dispatch-check'],
  ['npm run ops:settlement-options-write', 'npm run ops:settlement-options-check']
]) {
  const beforeIndex = transparencyWorkflow.indexOf(before);
  const afterIndex = transparencyWorkflow.indexOf(after);
  if (beforeIndex === -1 || afterIndex === -1 || beforeIndex >= afterIndex) {
    findings.push(`transparency publisher must run ${before} before ${after}`);
  }
}
if (!/public\/paid-promotion-ledger\.json/.test(workflow)) {
  findings.push(
    'revenue autopilot must include paid promotion ledger in committed operating state'
  );
}
if (/PRIVATE_KEY|SEED|MNEMONIC|WALLET_SECRET/.test(workflow)) {
  findings.push('revenue autopilot must not consume wallet secrets');
}
for (const commandPattern of [
  /sats-prospect-stage-agent\.mjs advance[^`]*--transitionedAtUtc "<transitioned-at-utc>"/,
  /sats-outreach-approval-agent\.mjs advance[^`]*--transitionedAtUtc "<transitioned-at-utc>"/,
  /sats-prospect-response-agent\.mjs record-contacted[^`]*--contactedAtUtc "<contacted-at-utc>"/,
  /sats-prospect-response-agent\.mjs record-invoice-request[^`]*--confirmedCustomerRequestedInvoice true[^`]*--requestedAtUtc "<requested-at-utc>"/
]) {
  if (!commandPattern.test(governanceDoc)) {
    findings.push(
      `governance doc must document timestamp-gated transition command ${commandPattern}`
    );
  }
}

if (findings.length > 0) {
  console.error('Revenue autopilot workflow check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Revenue autopilot workflow check passed: scheduled follow-through stays behind chairman approvals.'
);
