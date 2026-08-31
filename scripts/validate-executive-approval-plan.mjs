import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  approvalPhrase,
  assertChairmanDecisionConfirmation,
  buildExecutiveApprovalPlan,
  rejectionPhrase
} from './lib/executive-approval-plan.mjs';

const queue = JSON.parse(readFileSync(join('public', 'executive-approval-queue.json'), 'utf8'));
const prospectPipeline = JSON.parse(
  readFileSync(join('public', 'sats-prospect-pipeline.json'), 'utf8')
);
const plan = buildExecutiveApprovalPlan(queue, { prospectPipeline });
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
  if (!item.approveCommand.includes(`--confirm-chairman-approval "${approvalPhrase(item.id)}"`)) {
    findings.push(`${item.id}: approve command must include explicit chairman approval phrase`);
  }
  if (!item.rejectCommand.includes(`--confirm-chairman-rejection "${rejectionPhrase(item.id)}"`)) {
    findings.push(`${item.id}: reject command must include explicit chairman rejection phrase`);
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
if (prospectReview && prospectReview.nextCommandAfterApproval.includes('<chairman-selected-prospect-ids>')) {
  findings.push('prospect review approval must include concrete current batch prospect ids');
}
if (
  prospectReview &&
  !prospectReview.nextCommandAfterApproval.includes('--prospects arnold-solana,npc-meme,black-bull-ansem')
) {
  findings.push('prospect review approval must include the first bounded prospect batch');
}

assertRejects('missing approval confirmation', /Missing explicit chairman confirmation/i, () =>
  assertChairmanDecisionConfirmation({
    status: 'approved-by-chairman',
    itemId: 'prospect-review-batch-20260829',
    options: {}
  })
);
assertRejects('wrong rejection confirmation', /Missing explicit chairman confirmation/i, () =>
  assertChairmanDecisionConfirmation({
    status: 'rejected',
    itemId: 'prospect-review-batch-20260829',
    options: {
      'confirm-chairman-rejection': 'reject it'
    }
  })
);
assertChairmanDecisionConfirmation({
  status: 'approved-by-chairman',
  itemId: 'prospect-review-batch-20260829',
  options: {
    'confirm-chairman-approval': approvalPhrase('prospect-review-batch-20260829')
  }
});

if (findings.length > 0) {
  console.error('Executive approval plan check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Executive approval plan check passed: chairman decisions expose explicit commands and execution boundaries.');

function assertRejects(name, expected, fn) {
  try {
    fn();
  } catch (error) {
    if (!expected.test(error.message)) {
      throw new Error(`${name}: expected ${expected}, received ${error.message}`);
    }
    return;
  }
  throw new Error(`${name}: expected rejection.`);
}
