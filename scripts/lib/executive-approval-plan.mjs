export function buildExecutiveApprovalPlan(queue, { prospectPipeline = null } = {}) {
  if (!queue || typeof queue !== 'object') throw new Error('Missing executive approval queue.');

  const counts = {};
  for (const item of queue.items ?? []) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }

  const reviewItems = (queue.items ?? []).filter(
    (item) => item.status === 'ready-for-chairman-review'
  );

  return {
    project: queue.project,
    mode: queue.mode,
    executiveChairman: queue.executiveChairman,
    counts,
    chairmanReview: reviewItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      execution: item.execution,
      proposedAction: item.proposedAction,
      approveCommand: `npm run ops:approve -- ${item.id} --confirm-chairman-approval "${approvalPhrase(item.id)}"`,
      rejectCommand: `npm run ops:reject -- ${item.id} --confirm-chairman-rejection "${rejectionPhrase(item.id)}"`,
      nextCommandAfterApproval: inferNextCommandAfterApproval(item, { prospectPipeline }),
      evidenceCount: (item.evidence ?? []).length,
      riskControlCount: (item.riskReview ?? []).length,
      executionBoundary:
        'Approval records a chairman decision only. It does not execute a transaction, send payment instructions, contact prospects, approve paid promotion delivery, grant tokens, or move assets.'
    })),
    operatingBoundary:
      'Agents prepare and validate work. The Executive Chairman approves final transactions, proposals, promotions, partnerships, and public commitments.'
  };
}

export function approvalPhrase(itemId) {
  return `I am Executive Chairman and approve ${itemId}`;
}

export function rejectionPhrase(itemId) {
  return `I am Executive Chairman and reject ${itemId}`;
}

export function assertChairmanDecisionConfirmation({ status, itemId, options }) {
  const key = confirmationOptionName(status);
  const expected = expectedConfirmationPhrase({ status, itemId });
  if (options?.[key] !== expected) {
    throw new Error(`Missing explicit chairman confirmation. Expected --${key} "${expected}"`);
  }
  return true;
}

export function confirmationOptionName(status) {
  if (status === 'approved-by-chairman') return 'confirm-chairman-approval';
  if (status === 'rejected') return 'confirm-chairman-rejection';
  throw new Error(`Unsupported chairman decision status: ${status}`);
}

export function expectedConfirmationPhrase({ status, itemId }) {
  if (status === 'approved-by-chairman') return approvalPhrase(itemId);
  if (status === 'rejected') return rejectionPhrase(itemId);
  throw new Error(`Unsupported chairman decision status: ${status}`);
}

export function buildProspectReviewAdvanceCommand({ approvalId, prospectPipeline, approvalItem = null }) {
  const eligibleIds = prospectIdsFromProspectReviewApproval({
    approvalItem,
    prospectPipeline
  });
  if (eligibleIds.length === 0) {
    return `node scripts/sats-prospect-stage-agent.mjs advance --approvalId ${approvalId} --prospects "<chairman-selected-prospect-ids>"`;
  }
  return `node scripts/sats-prospect-stage-agent.mjs advance --approvalId ${approvalId} --prospects ${eligibleIds.join(',')}`;
}

export function buildOutreachApprovalAdvanceCommand({ approvalId, title }) {
  const ids = prospectIdsFromOutreachApprovalTitle(title);
  if (ids.length === 0) {
    return `node scripts/sats-outreach-approval-agent.mjs advance --approvalId ${approvalId} --prospects "<chairman-approved-prospect-ids>"`;
  }
  return `node scripts/sats-outreach-approval-agent.mjs advance --approvalId ${approvalId} --prospects ${ids.join(',')}`;
}

function inferNextCommandAfterApproval(item, { prospectPipeline }) {
  if (item.id.startsWith('prospect-review-batch-')) {
    return `node scripts/sats-prospect-stage-agent.mjs plan --approvalId ${item.id}, then ${buildProspectReviewAdvanceCommand({
      approvalId: item.id,
      approvalItem: item,
      prospectPipeline
    })}`;
  }
  if (item.id === 'reserve-growth-operating-policy') {
    return 'npm run ops:reserve-plan';
  }
  if (item.id === 'standard-promoter-intake-policy') {
    return 'npm run ops:plan';
  }
  if (item.id.startsWith('outreach-approval-')) {
    return `node scripts/sats-outreach-approval-agent.mjs transition-plan --approvalId ${item.id}, then ${buildOutreachApprovalAdvanceCommand(
      {
        approvalId: item.id,
        title: item.title
      }
    )}`;
  }
  return 'npm run ops:cycle-plan';
}

function prospectIdsFromOutreachApprovalTitle(title) {
  const match = /^Approve factual outreach to (?<ids>.+)$/.exec(title ?? '');
  if (!match?.groups?.ids) return [];
  return match.groups.ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function prospectIdsFromProspectReviewApproval({ approvalItem, prospectPipeline }) {
  const prospects = prospectPipeline?.prospects ?? [];
  const idsFromSummary = prospectIdsFromReviewSummary(approvalItem?.summary);
  if (idsFromSummary.length > 0) return idsFromSummary;

  const evidenceUrls = new Set(
    (approvalItem?.evidence ?? [])
      .map((item) => item.url)
      .filter(Boolean)
  );
  const idsFromEvidence = prospects
    .filter((prospect) => (prospect.evidence ?? []).some((url) => evidenceUrls.has(url)))
    .map((prospect) => prospect.id);
  if (idsFromEvidence.length > 0) return idsFromEvidence;

  return prospects
    .filter((prospect) => prospect.stage === 'identified')
    .slice(0, Number(prospectPipeline?.dailyCadence?.chairmanReviewBatchSize ?? 3))
    .map((prospect) => prospect.id);
}

export function prospectIdsFromReviewSummary(summary) {
  const match = /^Review (?<ids>.+?) as /i.exec(summary ?? '');
  if (!match?.groups?.ids) return [];
  return match.groups.ids
    .replace(/\band\b/g, ',')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
