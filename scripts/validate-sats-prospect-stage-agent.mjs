import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyProspectStageTransition,
  buildProspectStagePlan,
  validateProspectStageApprovalIntegrity
} from './lib/prospect-stage-transition.mjs';

const pipeline = JSON.parse(readFileSync(join('public', 'sats-prospect-pipeline.json'), 'utf8'));
const approvalQueue = JSON.parse(readFileSync(join('public', 'executive-approval-queue.json'), 'utf8'));
const approvalId = 'prospect-review-batch-stage-agent-fixture';
const findings = [];
const fixtureApproval = {
  id: approvalId,
  title: 'Review stage-agent fixture prospects',
  category: 'revenue-action',
  status: 'ready-for-chairman-review',
  requiredChairmanApproval: true
};
const fixtureApprovalQueue = {
  ...approvalQueue,
  items: [...(approvalQueue.items ?? []).filter((item) => item.id !== approvalId), fixtureApproval]
};
const fixtureProspects = pipeline.prospects.slice(0, 2).map((prospect) => ({
  ...prospect,
  stage: 'identified',
  chairmanApprovedBeforeOutreach: false,
  stageApprovalId: undefined,
  stageUpdatedAtUtc: undefined,
  stageNotes: undefined,
  outreachApprovalId: undefined,
  outreachApprovedAtUtc: undefined
}));
const transitionFixture = {
  ...pipeline,
  prospects: [...fixtureProspects, ...pipeline.prospects.slice(2)]
};
const firstIdentified = transitionFixture.prospects.find((prospect) => prospect.stage === 'identified');
const secondIdentified = transitionFixture.prospects.find(
  (prospect) => prospect.stage === 'identified' && prospect.id !== firstIdentified?.id
);
if (!firstIdentified || !secondIdentified) {
  findings.push('test fixture must include at least two identified prospects');
}

const plan = buildProspectStagePlan({ pipeline, approvalQueue: fixtureApprovalQueue, approvalId });
if (plan.mode !== 'chairman-gated-prospect-stage-transition') {
  findings.push('plan mode must be chairman-gated-prospect-stage-transition');
}
if (plan.eligibleProspects.length > pipeline.dailyCadence.chairmanReviewBatchSize) {
  findings.push('plan must respect chairmanReviewBatchSize');
}
const approvalConsumed = pipeline.prospects.some((prospect) => prospect.stageApprovalId === approvalId);
const expectedBacklog = Math.max(
  pipeline.prospects.filter((prospect) => prospect.stage === 'identified').length -
    (approvalConsumed ? 0 : pipeline.dailyCadence.chairmanReviewBatchSize),
  0
);
if (plan.backlogProspects !== expectedBacklog) {
  findings.push('plan must report identified prospect backlog beyond the next review batch');
}
if (fixtureApprovalQueue.items.find((item) => item.id === approvalId)?.status !== 'approved-by-chairman') {
  if (plan.blocked !== true) findings.push('plan must be blocked while approval is not approved');
  if (!/Executive Chairman/i.test(plan.blockedReason ?? '')) {
    findings.push('blocked plan must name the Executive Chairman approval gate');
  }
}
if (!/does not approve outreach/i.test(plan.boundary ?? '')) {
  findings.push('plan boundary must reject implied outreach approval');
}

const unapprovedQueue = {
  ...fixtureApprovalQueue,
  items: fixtureApprovalQueue.items.map((item) =>
    item.id === approvalId
      ? {
          ...item,
          status: 'ready-for-chairman-review',
          approvedBy: undefined,
          approvedAtUtc: undefined
        }
      : item
  )
};

assertRejects('unapproved advancement', /not approved by the Executive Chairman/i, () =>
  applyProspectStageTransition({
    pipeline: transitionFixture,
    approvalQueue: unapprovedQueue,
    approvalId,
    prospectIds: [firstIdentified?.id]
  })
);

const approvedQueue = {
  ...fixtureApprovalQueue,
  items: fixtureApprovalQueue.items.map((item) =>
    item.id === approvalId
      ? {
          ...item,
          status: 'approved-by-chairman',
          approvedBy: 'executive-chairman',
          approvedAtUtc: '2026-08-29T08:45:00.000Z'
        }
      : item
  )
};
const updated = applyProspectStageTransition({
  pipeline: transitionFixture,
  approvalQueue: approvedQueue,
  approvalId,
  prospectIds: [firstIdentified?.id],
  transitionedAtUtc: '2026-08-29T08:45:00.000Z'
});
const moved = updated.prospects.find((prospect) => prospect.id === firstIdentified?.id);
if (moved?.stage !== 'chairman-review') findings.push('approved transition must move to chairman-review');
if (moved?.chairmanApprovedBeforeOutreach !== true) {
  findings.push('approved transition must record pre-outreach chairman approval');
}
if (moved?.stageApprovalId !== approvalId) findings.push('approved transition must record approval id');
if (/outreach approved/i.test(moved?.stageNotes ?? '')) {
  findings.push('stage notes must not imply outreach approval');
}
try {
  validateProspectStageApprovalIntegrity({ pipeline: updated, approvalQueue: approvedQueue });
} catch (error) {
  findings.push(`approved transition must preserve stage approval integrity: ${error.message}`);
}

assertRejects('unapproved stored stage approval', /must be approved-by-chairman/i, () =>
  validateProspectStageApprovalIntegrity({
    pipeline: {
      ...transitionFixture,
      prospects: transitionFixture.prospects.map((prospect) =>
        prospect.id === firstIdentified?.id
          ? {
              ...prospect,
              stage: 'chairman-review',
              chairmanApprovedBeforeOutreach: true,
              stageApprovalId: approvalId
            }
          : prospect
      )
    },
    approvalQueue: unapprovedQueue
  })
);

assertRejects('wrong target stage', /Only chairman-review transitions/i, () =>
  applyProspectStageTransition({
    pipeline: transitionFixture,
    approvalQueue: approvedQueue,
    approvalId,
    prospectIds: [firstIdentified?.id],
    targetStage: 'outreach-approved'
  })
);
assertRejects('unknown prospect', /Prospect not found/i, () =>
  applyProspectStageTransition({
    pipeline: transitionFixture,
    approvalQueue: approvedQueue,
    approvalId,
    prospectIds: ['missing-prospect']
  })
);
assertRejects('oversized transition batch', /exceeds chairman review batch size/i, () =>
  applyProspectStageTransition({
    pipeline: transitionFixture,
    approvalQueue: approvedQueue,
    approvalId,
    prospectIds: ['arnold-solana', 'npc-meme', 'black-bull-ansem', 'roach-solana']
  })
);
assertRejects('reused approval id', /already been used/i, () =>
  applyProspectStageTransition({
    pipeline: updated,
    approvalQueue: approvedQueue,
    approvalId,
    prospectIds: [secondIdentified?.id]
  })
);

if (findings.length > 0) {
  console.error('Sats prospect stage agent check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats prospect stage agent check passed: prospect advancement requires chairman approval and preserves outreach gates.');

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
