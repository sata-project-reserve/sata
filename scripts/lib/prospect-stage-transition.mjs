export function buildProspectStagePlan({
  pipeline,
  approvalQueue,
  approvalId = 'prospect-review-batch-20260829'
}) {
  assertInputs({ pipeline, approvalQueue });
  const approval = findApproval(approvalQueue, approvalId);
  const identified = (pipeline.prospects ?? []).filter((prospect) => prospect.stage === 'identified');
  const approvalConsumed = (pipeline.prospects ?? []).some(
    (prospect) => prospect.stageApprovalId === approvalId
  );
  const reviewBatchSize = getReviewBatchSize(pipeline);
  const eligibleProspects = approvalConsumed ? [] : identified.slice(0, reviewBatchSize);

  return {
    project: pipeline.project,
    mode: 'chairman-gated-prospect-stage-transition',
    approvalId,
    approvalStatus: approval?.status ?? 'missing',
    reviewBatchSize,
    backlogProspects: Math.max(identified.length - eligibleProspects.length, 0),
    eligibleProspects: eligibleProspects.map((prospect) => ({
      id: prospect.id,
      currentStage: prospect.stage,
      proposedStage: 'chairman-review',
      publicProfileUrl: prospect.publicProfileUrl,
      projectUrl: prospect.projectUrl
    })),
    blocked: approval?.status !== 'approved-by-chairman' || approvalConsumed,
    blockedReason:
      approval?.status !== 'approved-by-chairman'
        ? 'Prospects cannot move beyond identified until the matching approval item is approved by the Executive Chairman.'
        : approvalConsumed
          ? `${approvalId} has already been used for a prospect stage transition. Create a new approval item before advancing another batch.`
          : null,
    boundary:
      'This transition does not approve outreach, invoices, payment requests, paid work, token grants, or asset movement.'
  };
}

export function applyProspectStageTransition({
  pipeline,
  approvalQueue,
  approvalId = 'prospect-review-batch-20260829',
  prospectIds,
  targetStage = 'chairman-review',
  transitionedAtUtc = new Date().toISOString()
}) {
  assertInputs({ pipeline, approvalQueue });
  if (targetStage !== 'chairman-review') {
    throw new Error('Only chairman-review transitions are supported by this approval gate.');
  }
  const approval = findApproval(approvalQueue, approvalId);
  if (approval?.status !== 'approved-by-chairman') {
    throw new Error(`${approvalId} is not approved by the Executive Chairman.`);
  }
  if ((pipeline.prospects ?? []).some((prospect) => prospect.stageApprovalId === approvalId)) {
    throw new Error(`${approvalId} has already been used for a prospect stage transition.`);
  }

  const ids = normalizeIds(prospectIds);
  const reviewBatchSize = getReviewBatchSize(pipeline);
  if (ids.size > reviewBatchSize) {
    throw new Error(`Prospect stage transition exceeds chairman review batch size of ${reviewBatchSize}.`);
  }
  const prospects = (pipeline.prospects ?? []).map((prospect) => {
    if (!ids.has(prospect.id)) return prospect;
    if (prospect.stage !== 'identified') {
      throw new Error(`${prospect.id}: only identified prospects can move to chairman-review.`);
    }
    return {
      ...prospect,
      stage: targetStage,
      chairmanApprovedBeforeOutreach: true,
      stageUpdatedAtUtc: transitionedAtUtc,
      stageApprovalId: approvalId,
      stageNotes:
        'Moved to chairman-review after Executive Chairman approval. Outreach still requires a separate explicit decision.'
    };
  });

  for (const id of ids) {
    if (!prospects.some((prospect) => prospect.id === id)) {
      throw new Error(`Prospect not found: ${id}`);
    }
  }

  return {
    ...pipeline,
    updatedAtUtc: transitionedAtUtc,
    prospects
  };
}

export function validateProspectStageApprovalIntegrity({ pipeline, approvalQueue }) {
  assertInputs({ pipeline, approvalQueue });
  const approvals = new Map((approvalQueue.items ?? []).map((item) => [item.id, item]));
  const findings = [];

  for (const prospect of pipeline.prospects ?? []) {
    if (prospect.stage === 'identified') {
      if (prospect.stageApprovalId) {
        findings.push(`${prospect.id}: identified prospects must not carry a stageApprovalId`);
      }
      continue;
    }

    if (prospect.chairmanApprovedBeforeOutreach !== true) {
      findings.push(`${prospect.id}: non-identified prospects require chairmanApprovedBeforeOutreach`);
    }

    if (!prospect.stageApprovalId) {
      findings.push(`${prospect.id}: non-identified prospects require a stageApprovalId`);
      continue;
    }

    const approval = approvals.get(prospect.stageApprovalId);
    if (!approval) {
      findings.push(`${prospect.id}: stageApprovalId ${prospect.stageApprovalId} is missing from executive approval queue`);
      continue;
    }
    if (approval.status !== 'approved-by-chairman') {
      findings.push(
        `${prospect.id}: stageApprovalId ${prospect.stageApprovalId} must be approved-by-chairman before stage ${prospect.stage}`
      );
    }
  }

  if (findings.length > 0) {
    throw new Error(findings.join('\n'));
  }
}

function assertInputs({ pipeline, approvalQueue }) {
  if (!pipeline || typeof pipeline !== 'object') throw new Error('Missing prospect pipeline.');
  if (!approvalQueue || typeof approvalQueue !== 'object') throw new Error('Missing approval queue.');
}

function findApproval(approvalQueue, approvalId) {
  return (approvalQueue.items ?? []).find((item) => item.id === approvalId);
}

function normalizeIds(value) {
  const ids = Array.isArray(value) ? value : String(value ?? '').split(',');
  const cleaned = ids.map((id) => String(id).trim()).filter(Boolean);
  if (cleaned.length === 0) throw new Error('At least one prospect id is required.');
  return new Set(cleaned);
}

function getReviewBatchSize(pipeline) {
  const size = Number(pipeline.dailyCadence?.chairmanReviewBatchSize ?? 3);
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new Error('dailyCadence.chairmanReviewBatchSize must be an integer >= 1.');
  }
  return size;
}
