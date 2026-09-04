import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyApprovedFollowthrough } from './lib/approved-followthrough.mjs';

const approvalQueue = JSON.parse(readFileSync(join('public', 'executive-approval-queue.json'), 'utf8'));
const pipeline = JSON.parse(readFileSync(join('public', 'sats-prospect-pipeline.json'), 'utf8'));
const deliveryKit = JSON.parse(readFileSync(join('public', 'transparency-audit-delivery-kit.json'), 'utf8'));
const packetQueue = JSON.parse(readFileSync(join('public', 'service-outreach-packet-queue.json'), 'utf8'));
const referralPolicy = JSON.parse(readFileSync(join('public', 'referral-partner-policy.json'), 'utf8'));
const findings = [];

const idlePlan = applyApprovedFollowthrough({
  approvalQueue,
  pipeline,
  deliveryKit,
  packetQueue,
  referralPolicy,
  generatedAtUtc: '2026-09-03T17:00:00.000Z'
});
if (idlePlan.mode !== 'approved-only-followthrough') {
  findings.push('follow-through mode must be approved-only-followthrough');
}
if (!/does not approve items/i.test(idlePlan.boundary ?? '')) {
  findings.push('follow-through boundary must reject approval authority');
}
if (idlePlan.actions.some((action) => !action.type.endsWith('-skipped'))) {
  findings.push('current live state should not have unconsumed approved follow-through actions');
}

const fixtureReviewApprovalId = 'prospect-review-batch-20260903-fixture-alpha-fixture-beta';
const fixturePriorReviewApprovalId = 'prospect-review-batch-20260903-fixture-gamma-fixture-delta';
const fixtureOutreachApprovalId = 'outreach-approval-20260903-fixture-gamma-fixture-delta';
const fixtureReferralApprovalId = 'post-receipt-referral-partner-policy-fixture';
const approvedQueue = {
  ...approvalQueue,
  items: [...(approvalQueue.items ?? [])]
};
approvedQueue.items.push({
  id: fixtureReferralApprovalId,
  title: 'Approve synthetic referral policy fixture',
  category: 'promoter-offer',
  status: 'approved-by-chairman',
  createdAtUtc: '2026-09-03T17:00:00.000Z',
  preparedBy: 'codex-ops',
  summary: 'Synthetic validator fixture for referral policy follow-through.',
  rationale: 'Synthetic validator fixture.',
  proposedAction: 'Mark only the referral policy record approved after confirmed customer receipt rules remain intact.',
  execution: 'manual-chairman-action',
  requiredChairmanApproval: true,
  riskReview: ['Synthetic validation only.'],
  publicDisclosure: 'Sponsored/Paid Partnership or token-compensated referral relationship when applicable.',
  evidence: [
    {
      type: 'policy-json',
      url: 'public/referral-partner-policy.json'
    }
  ],
  approvedBy: 'executive-chairman',
  approvedAtUtc: '2026-09-03T17:00:00.000Z'
});
approvedQueue.items.push({
  id: fixtureReviewApprovalId,
  title: 'Review fixture approved follow-through batch',
  category: 'revenue-action',
  status: 'approved-by-chairman',
  createdAtUtc: '2026-09-03T17:00:00.000Z',
  preparedBy: 'codex-ops',
  summary: 'Review fixture-alpha, fixture-beta as synthetic transparency-audit prospects.',
  rationale: 'Synthetic validator fixture.',
  proposedAction: 'Advance only the named synthetic prospects to chairman-review.',
  execution: 'manual-chairman-action',
  requiredChairmanApproval: true,
  riskReview: ['Synthetic validation only.'],
  publicDisclosure: 'Synthetic validation only.',
  evidence: [
    {
      type: 'prospect-evidence',
      url: 'https://example.com/fixture-alpha'
    },
    {
      type: 'prospect-evidence',
      url: 'https://example.com/fixture-beta'
    }
  ],
  approvedBy: 'executive-chairman',
  approvedAtUtc: '2026-09-03T17:00:00.000Z'
});
approvedQueue.items.push({
  id: fixtureOutreachApprovalId,
  title: 'Approve factual outreach to fixture-gamma, fixture-delta',
  category: 'revenue-action',
  status: 'approved-by-chairman',
  createdAtUtc: '2026-09-03T17:00:00.000Z',
  preparedBy: 'codex-ops',
  summary: 'Approve contact-only outreach for synthetic chairman-reviewed prospects.',
  rationale: 'Synthetic validator fixture.',
  proposedAction: 'Approve one factual transparency-audit outreach message per listed synthetic prospect.',
  execution: 'manual-chairman-action',
  requiredChairmanApproval: true,
  riskReview: ['Synthetic validation only.'],
  publicDisclosure: 'Synthetic validation only.',
  evidence: [
    {
      type: 'prospect-evidence',
      url: 'https://example.com/fixture-gamma'
    },
    {
      type: 'prospect-evidence',
      url: 'https://example.com/fixture-delta'
    }
  ],
  approvedBy: 'executive-chairman',
  approvedAtUtc: '2026-09-03T17:00:00.000Z'
});
const fixturePipeline = {
  ...pipeline,
  prospects: [
    ...(pipeline.prospects ?? []),
    {
      id: 'fixture-alpha',
      stage: 'identified',
      source: 'synthetic-validator',
      publicProfileUrl: 'https://example.com/fixture-alpha',
      projectUrl: 'https://example.com/fixture-alpha',
      observedClaim: 'Synthetic validator prospect.',
      recommendedOfferId: 'transparency-audit',
      chairmanApprovedBeforeOutreach: false,
      evidence: ['https://example.com/fixture-alpha'],
      notes: 'Synthetic validator only.'
    },
    {
      id: 'fixture-beta',
      stage: 'identified',
      source: 'synthetic-validator',
      publicProfileUrl: 'https://example.com/fixture-beta',
      projectUrl: 'https://example.com/fixture-beta',
      observedClaim: 'Synthetic validator prospect.',
      recommendedOfferId: 'transparency-audit',
      chairmanApprovedBeforeOutreach: false,
      evidence: ['https://example.com/fixture-beta'],
      notes: 'Synthetic validator only.'
    },
    {
      id: 'fixture-gamma',
      stage: 'chairman-review',
      source: 'synthetic-validator',
      publicProfileUrl: 'https://example.com/fixture-gamma',
      projectUrl: 'https://example.com/fixture-gamma',
      observedClaim: 'Synthetic validator prospect.',
      recommendedOfferId: 'transparency-audit',
      chairmanApprovedBeforeOutreach: true,
      stageApprovalId: fixturePriorReviewApprovalId,
      evidence: ['https://example.com/fixture-gamma'],
      notes: 'Synthetic validator only.'
    },
    {
      id: 'fixture-delta',
      stage: 'chairman-review',
      source: 'synthetic-validator',
      publicProfileUrl: 'https://example.com/fixture-delta',
      projectUrl: 'https://example.com/fixture-delta',
      observedClaim: 'Synthetic validator prospect.',
      recommendedOfferId: 'transparency-audit',
      chairmanApprovedBeforeOutreach: true,
      stageApprovalId: fixturePriorReviewApprovalId,
      evidence: ['https://example.com/fixture-delta'],
      notes: 'Synthetic validator only.'
    }
  ]
};

const advanced = applyApprovedFollowthrough({
  approvalQueue: approvedQueue,
  pipeline: fixturePipeline,
  deliveryKit,
  packetQueue,
  referralPolicy: {
    ...referralPolicy,
    approvalItemId: fixtureReferralApprovalId,
    status: 'pending-executive-chairman-approval',
    approvedBy: undefined,
    approvedAtUtc: undefined
  },
  generatedAtUtc: '2026-09-03T17:00:00.000Z'
});

for (const id of ['fixture-alpha', 'fixture-beta']) {
  const prospect = advanced.pipeline.prospects.find((item) => item.id === id);
  if (prospect?.stage !== 'chairman-review') {
    findings.push(`${id}: synthetic approved prospect review must advance to chairman-review`);
  }
  if (prospect?.stageApprovalId !== fixtureReviewApprovalId) {
    findings.push(`${id}: synthetic approved prospect review must preserve the approval id`);
  }
}

if (
  !advanced.approvalQueue.items.some(
    (item) =>
      item.id === 'outreach-approval-20260903-fixture-alpha-fixture-beta' &&
      item.status === 'ready-for-chairman-review'
  )
) {
  findings.push('synthetic approved prospect review must draft a matching outreach approval gate');
}

for (const id of ['fixture-gamma', 'fixture-delta']) {
  const prospect = advanced.pipeline.prospects.find((item) => item.id === id);
  if (prospect?.stage !== 'outreach-approved') {
    findings.push(`${id}: approved outreach follow-through must advance to outreach-approved`);
  }
  if (prospect?.outreachApprovalId !== fixtureOutreachApprovalId) {
    findings.push(`${id}: approved outreach follow-through must preserve the outreach approval id`);
  }
  if (!advanced.packetQueue.packets.some((packet) => packet.prospectId === id)) {
    findings.push(`${id}: approved outreach follow-through must write a manual outreach packet`);
  }
}

if (advanced.actions.some((action) => /contact|invoice|asset|token/i.test(action.type))) {
  findings.push('follow-through actions must not contact, invoice, move assets, or grant tokens');
}

if (advanced.referralPolicy?.status !== 'approved-by-chairman') {
  findings.push('approved referral policy follow-through must mark policy approved');
}
if (advanced.referralPolicy?.approvedBy !== 'executive-chairman') {
  findings.push('approved referral policy follow-through must preserve chairman approval');
}
if (
  !advanced.actions.some(
    (action) =>
      action.type === 'referral-policy-marked-approved' &&
      action.approvalId === fixtureReferralApprovalId
  )
) {
  findings.push('approved referral policy follow-through must record an action');
}
if (
  advanced.actions.some(
    (action) =>
      action.type === 'referral-policy-marked-approved' &&
      action.approvalId !== fixtureReferralApprovalId
  )
) {
  findings.push('referral policy follow-through must preserve the approval id');
}

if (findings.length > 0) {
  console.error('Approved follow-through check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Approved follow-through check passed: approved gates can advance without approving, contacting, invoicing, or moving assets.');
