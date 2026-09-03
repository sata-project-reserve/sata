import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflow = readFileSync(join('.github', 'workflows', 'revenue-autopilot.yml'), 'utf8');
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
  'npm run ops:check',
  'npm run ops:approval-plan-check',
  'npm run ops:approval-followthrough-check',
  'npm run ops:prospect-check',
  'npm run ops:outreach-approval-check',
  'npm run ops:outreach-check',
  'npm run ops:cycle-check'
]) {
  if (!workflow.includes(requiredCommand)) {
    findings.push(`revenue autopilot must run ${requiredCommand}`);
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
if (/PRIVATE_KEY|SEED|MNEMONIC|WALLET_SECRET/.test(workflow)) {
  findings.push('revenue autopilot must not consume wallet secrets');
}

if (findings.length > 0) {
  console.error('Revenue autopilot workflow check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Revenue autopilot workflow check passed: scheduled follow-through stays behind chairman approvals.');
