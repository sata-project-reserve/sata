import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  approvalPhrase,
  assertChairmanDecisionConfirmation,
  buildExecutiveApprovalPlan,
  prospectIdsFromReviewSummary,
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

const prospectReviews = plan.chairmanReview.filter((item) => item.id.startsWith('prospect-review-batch-'));
for (const prospectReview of prospectReviews) {
  if (!/sats-prospect-stage-agent\.mjs advance/i.test(prospectReview.nextCommandAfterApproval)) {
    findings.push(`${prospectReview.id}: prospect review approval must point to the bounded prospect stage transition`);
  }
  if (prospectReview.nextCommandAfterApproval.includes('<chairman-selected-prospect-ids>')) {
    findings.push(`${prospectReview.id}: prospect review approval must include concrete prospect ids`);
  }
  const sourceItem = readyItems.find((item) => item.id === prospectReview.id);
  const expectedProspectIds = prospectIdsFromReviewSummary(sourceItem?.summary).join(',');
  if (expectedProspectIds && !prospectReview.nextCommandAfterApproval.includes(`--prospects ${expectedProspectIds}`)) {
    findings.push(`${prospectReview.id}: prospect review approval must include its approval-item prospect batch`);
  }
}

const outreachReviews = plan.chairmanReview.filter((item) => item.id.startsWith('outreach-approval-'));
for (const outreachReview of outreachReviews) {
  if (!/sats-outreach-approval-agent\.mjs advance/i.test(outreachReview.nextCommandAfterApproval)) {
    findings.push(`${outreachReview.id}: outreach approval must point to the bounded outreach transition`);
  }
  const expectedProspectIds = prospectIdsFromOutreachApprovalTitle(outreachReview.title).join(',');
  if (
    expectedProspectIds &&
    !outreachReview.nextCommandAfterApproval.includes(`--prospects ${expectedProspectIds}`)
  ) {
    findings.push(`${outreachReview.id}: outreach approval must include the chairman-reviewed prospect ids`);
  }
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

function prospectIdsFromOutreachApprovalTitle(title) {
  const match = /^Approve factual outreach to (?<ids>.+)$/.exec(title ?? '');
  if (!match?.groups?.ids) return [];
  return match.groups.ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
