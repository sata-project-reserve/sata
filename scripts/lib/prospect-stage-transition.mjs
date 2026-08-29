export function buildProspectStagePlan({
  pipeline,
  approvalQueue,
  approvalId = 'prospect-review-batch-20260829'
}) {
  assertInputs({ pipeline, approvalQueue });
  const approval = findApproval(approvalQueue, approvalId);
  const identified = (pipeline.prospects ?? []).filter((prospect) => prospect.stage === 'identified');
  const reviewBatchSize = getReviewBatchSize(pipeline);
  const eligibleProspects = identified.slice(0, reviewBatchSize);

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
    blocked: approval?.status !== 'approved-by-chairman',
    blockedReason:
      approval?.status === 'approved-by-chairman'
        ? null
        : 'Prospects cannot move beyond identified until the matching approval item is approved by the Executive Chairman.',
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
