export function buildExecutiveApprovalPlan(queue) {
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
      approveCommand: `npm run ops:approve -- ${item.id}`,
      rejectCommand: `npm run ops:reject -- ${item.id}`,
      nextCommandAfterApproval: inferNextCommandAfterApproval(item),
      evidenceCount: (item.evidence ?? []).length,
      riskControlCount: (item.riskReview ?? []).length,
      executionBoundary:
        'Approval records a chairman decision only. It does not execute a transaction, send payment instructions, contact prospects, approve paid promotion delivery, grant tokens, or move assets.'
    })),
    operatingBoundary:
      'Agents prepare and validate work. The Executive Chairman approves final transactions, proposals, promotions, partnerships, and public commitments.'
  };
}

function inferNextCommandAfterApproval(item) {
  if (item.id === 'prospect-review-batch-20260829') {
    return `npm run ops:prospect-stage-plan, then node scripts/sats-prospect-stage-agent.mjs advance --approvalId ${item.id} --prospects "<chairman-selected-prospect-ids>"`;
  }
  if (item.id === 'reserve-growth-operating-policy') {
    return 'npm run ops:reserve-plan';
  }
  if (item.id === 'standard-promoter-intake-policy') {
    return 'npm run ops:plan';
  }
  return 'npm run ops:cycle-plan';
}
