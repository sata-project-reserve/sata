import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildExecutiveApprovalPlan } from './lib/executive-approval-plan.mjs';

const queue = JSON.parse(readFileSync(join('public', 'executive-approval-queue.json'), 'utf8'));
const plan = buildExecutiveApprovalPlan(queue);
const findings = [];
const readyItems = (queue.items ?? []).filter((item) => item.status === 'ready-for-chairman-review');

if (plan.mode !== 'executive-chairman-final-approval') {
  findings.push('plan mode must preserve executive-chairman-final-approval');
}
if (!/Executive Chairman approves/i.test(plan.operatingBoundary ?? '')) {
  findings.push('plan operating boundary must preserve chairman authority');
}
if (plan.chairmanReview.length !== readyItems.length) {
  findings.push('plan must include every ready-for-chairman-review item');
}

for (const item of plan.chairmanReview) {
  if (item.approveCommand !== `npm run ops:approve -- ${item.id}`) {
    findings.push(`${item.id}: approve command must be explicit`);
  }
  if (item.rejectCommand !== `npm run ops:reject -- ${item.id}`) {
    findings.push(`${item.id}: reject command must be explicit`);
  }
  if (!/does not execute a transaction/i.test(item.executionBoundary ?? '')) {
    findings.push(`${item.id}: execution boundary must reject transaction execution`);
  }
  if (!item.nextCommandAfterApproval) {
    findings.push(`${item.id}: next command after approval is required`);
  }
}

const prospectReview = plan.chairmanReview.find((item) => item.id === 'prospect-review-batch-20260829');
if (prospectReview && !/sats-prospect-stage-agent\.mjs advance/i.test(prospectReview.nextCommandAfterApproval)) {
  findings.push('prospect review approval must point to the bounded prospect stage transition');
}

if (findings.length > 0) {
  console.error('Executive approval plan check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Executive approval plan check passed: chairman decisions expose explicit commands and execution boundaries.');
