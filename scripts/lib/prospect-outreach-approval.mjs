export function buildOutreachApprovalPacket({
  pipeline,
  prospectIds,
  generatedAtUtc = new Date().toISOString()
}) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');
  const selected = selectProspects({ pipeline, prospectIds });
  const outreachLimit = Number(pipeline.dailyCadence?.outreachLimit ?? 3);
  if (!Number.isSafeInteger(outreachLimit) || outreachLimit < 1) {
    throw new Error('dailyCadence.outreachLimit must be an integer >= 1.');
  }
  if (selected.length > outreachLimit) {
    throw new Error(`Outreach approval packet exceeds daily outreach limit of ${outreachLimit}.`);
  }

  return {
    project: pipeline.project,
    mode: 'chairman-outreach-approval-packet',
    generatedAtUtc,
    activeCycleId: pipeline.activeCycleId,
    primaryOfferId: pipeline.primaryOfferId,
    candidateCount: selected.length,
    candidates: selected.map((prospect) => ({
      id: prospect.id,
      currentStage: prospect.stage,
      proposedStage: 'outreach-approved',
      publicProfileUrl: prospect.publicProfileUrl,
      projectUrl: prospect.projectUrl,
      observedClaim: prospect.observedClaim,
      recommendedOfferId: prospect.recommendedOfferId,
      evidence: prospect.evidence,
      contactScope:
        'One factual transparency-audit outreach message using an approved template. No invoice or payment instruction.'
    })),
    approvalItem: buildApprovalItem({ prospects: selected, generatedAtUtc }),
    boundary:
      'This packet asks for contact approval only. It does not approve invoices, payment requests, paid work, token grants, commitments, or asset movement.'
  };
}

export function renderOutreachApprovalPacket({ pipeline, prospectIds, generatedAtUtc }) {
  const packet = buildOutreachApprovalPacket({ pipeline, prospectIds, generatedAtUtc });
  const lines = [
    '# SATA Outreach Approval Packet',
    '',
    `Project: ${packet.project}`,
    `Cycle: ${packet.activeCycleId}`,
    `Generated: ${packet.generatedAtUtc}`,
    `Candidates: ${packet.candidateCount}`,
    '',
    '## Contact Candidates'
  ];

  for (const candidate of packet.candidates) {
    lines.push(
      '',
      `### ${candidate.id}`,
      '',
      `- Current stage: ${candidate.currentStage}`,
      `- Proposed stage: ${candidate.proposedStage}`,
      `- Profile: ${candidate.publicProfileUrl}`,
      `- Project: ${candidate.projectUrl}`,
      `- Observed public claim: ${candidate.observedClaim}`,
      `- Recommended offer: ${candidate.recommendedOfferId}`,
      `- Contact scope: ${candidate.contactScope}`,
      `- Evidence: ${candidate.evidence.join(', ')}`
    );
  }

  lines.push(
    '',
    '## Draft Approval Item',
    '',
    `- ID: ${packet.approvalItem.id}`,
    `- Title: ${packet.approvalItem.title}`,
    `- Category: ${packet.approvalItem.category}`,
    `- Status: ${packet.approvalItem.status}`,
    `- Proposed action: ${packet.approvalItem.proposedAction}`,
    '',
    '## Boundary',
    '',
    packet.boundary
  );

  return lines.join('\n');
}

export function buildOutreachApprovalTransitionPlan({ pipeline, approvalQueue, approvalId }) {
  assertInputs({ pipeline, approvalQueue });
  const approval = findApproval(approvalQueue, approvalId);
  const prospectIds = prospectIdsFromApproval(approval);
  const approvalHasProspectScope = prospectIds.size > 0;
  const approvalConsumed = (pipeline.prospects ?? []).some(
    (prospect) => prospect.outreachApprovalId === approvalId
  );
  const eligibleProspects =
    approval?.status === 'approved-by-chairman' && approvalHasProspectScope && !approvalConsumed
      ? selectProspects({ pipeline, prospectIds })
      : [];

  return {
    project: pipeline.project,
    mode: 'chairman-gated-outreach-stage-transition',
    approvalId,
    approvalStatus: approval?.status ?? 'missing',
    eligibleProspects: eligibleProspects.map((prospect) => ({
      id: prospect.id,
      currentStage: prospect.stage,
      proposedStage: 'outreach-approved',
      publicProfileUrl: prospect.publicProfileUrl,
      projectUrl: prospect.projectUrl
    })),
    blocked: approval?.status !== 'approved-by-chairman' || !approvalHasProspectScope || approvalConsumed,
    blockedReason:
      approval?.status !== 'approved-by-chairman'
        ? 'Prospects cannot move to outreach-approved until the matching outreach approval is approved by the Executive Chairman.'
        : !approvalHasProspectScope
          ? `${approvalId} must explicitly name the approved prospect ids.`
          : approvalConsumed
            ? `${approvalId} has already been used for an outreach approval transition.`
            : null,
    boundary:
      'This transition approves one factual outreach message only. It does not approve invoices, payment requests, paid work, token grants, commitments, or asset movement.'
  };
}

export function applyOutreachApprovalTransition({
  pipeline,
  approvalQueue,
  approvalId,
  prospectIds,
  transitionedAtUtc = new Date().toISOString()
}) {
  assertInputs({ pipeline, approvalQueue });
  const approval = findApproval(approvalQueue, approvalId);
  if (approval?.status !== 'approved-by-chairman') {
    throw new Error(`${approvalId} is not approved by the Executive Chairman.`);
  }
  if ((pipeline.prospects ?? []).some((prospect) => prospect.outreachApprovalId === approvalId)) {
    throw new Error(`${approvalId} has already been used for an outreach approval transition.`);
  }
  const ids = normalizeIds(prospectIds);
  const approvedIds = prospectIdsFromApproval(approval);
  if (approvedIds.size === 0) {
    throw new Error(`${approvalId} must explicitly name the approved prospect ids.`);
  }
  for (const id of ids) {
    if (!approvedIds.has(id)) {
      throw new Error(`${id}: prospect is not included in ${approvalId}.`);
    }
  }
  const selected = selectProspects({ pipeline, prospectIds: [...ids] });
  const outreachLimit = Number(pipeline.dailyCadence?.outreachLimit ?? 3);
  if (selected.length > outreachLimit) {
    throw new Error(`Outreach approval transition exceeds daily outreach limit of ${outreachLimit}.`);
  }

  const prospects = (pipeline.prospects ?? []).map((prospect) => {
    if (!ids.has(prospect.id)) return prospect;
    return {
      ...prospect,
      stage: 'outreach-approved',
      stageUpdatedAtUtc: transitionedAtUtc,
      outreachApprovedAtUtc: transitionedAtUtc,
      outreachApprovalId: approvalId,
      stageNotes:
        'Approved for one factual transparency-audit outreach message. Invoices, payment instructions, paid work, token grants, and asset movement still require separate chairman approval.'
    };
  });

  return {
    ...pipeline,
    updatedAtUtc: transitionedAtUtc,
    prospects
  };
}

function selectProspects({ pipeline, prospectIds }) {
  const prospects = pipeline.prospects ?? [];
  const ids = normalizeIds(prospectIds);
  const selected =
    ids.size > 0
      ? [...ids].map((id) => {
          const prospect = prospects.find((candidate) => candidate.id === id);
          if (!prospect) throw new Error(`Prospect not found: ${id}`);
          return prospect;
        })
      : prospects.filter((prospect) => prospect.stage === 'chairman-review').slice(0, 3);

  if (selected.length === 0) {
    throw new Error('No chairman-review prospects are available for outreach approval.');
  }
  for (const prospect of selected) {
    if (prospect.stage !== 'chairman-review') {
      throw new Error(`${prospect.id}: outreach approval requires chairman-review stage.`);
    }
    if (prospect.chairmanApprovedBeforeOutreach !== true) {
      throw new Error(`${prospect.id}: outreach approval requires chairmanApprovedBeforeOutreach.`);
    }
  }
  return selected;
}

function assertInputs({ pipeline, approvalQueue }) {
  if (!pipeline || typeof pipeline !== 'object') throw new Error('Missing prospect pipeline.');
  if (!approvalQueue || typeof approvalQueue !== 'object') throw new Error('Missing approval queue.');
}

function findApproval(approvalQueue, approvalId) {
  return (approvalQueue.items ?? []).find((item) => item.id === approvalId);
}

function prospectIdsFromApproval(approval) {
  const match = /^Approve factual outreach to (?<ids>.+)$/.exec(approval?.title ?? '');
  return normalizeIds(match?.groups?.ids ?? '');
}

function buildApprovalItem({ prospects, generatedAtUtc }) {
  const dateId = generatedAtUtc.slice(0, 10).replaceAll('-', '');
  const prospectIds = prospects.map((prospect) => prospect.id);
  return {
    id: `outreach-approval-${dateId}-${prospectIds.join('-').replace(/[^a-z0-9-]/g, '-')}`,
    title: `Approve factual outreach to ${prospectIds.join(', ')}`,
    category: 'revenue-action',
    status: 'ready-for-chairman-review',
    createdAtUtc: generatedAtUtc,
    preparedBy: 'codex-ops',
    summary:
      'Approve contact-only outreach for chairman-reviewed transparency-audit prospects using repository-approved templates.',
    rationale:
      'Qualified service prospects are needed before SATA can request exact-sats invoices and generate confirmed reserve receipts.',
    proposedAction:
      'Approve one factual transparency-audit outreach message per listed prospect. This does not approve invoices, payment instructions, paid work, token grants, or asset movement.',
    execution: 'manual-chairman-action',
    requiredChairmanApproval: true,
    riskReview: [
      'Outreach is limited to prospects already in chairman-review stage.',
      'Messages must use approved transparency-audit templates.',
      'No price, return, liquidity, revenue, buyer, or market-support claim is approved.',
      'Any invoice or payment instruction requires a separate chairman-approved exact-sats invoice.'
    ],
    publicDisclosure:
      'SATA may sell transparency tooling and public-reporting services. No price guarantee, no redemption promise, no revenue guarantee, and no market-support commitment.',
    evidence: prospects.map((prospect) => ({
      type: 'prospect-evidence',
      url: prospect.projectUrl
    }))
  };
}

function normalizeIds(value) {
  if (value instanceof Set) return new Set([...value].map((id) => String(id).trim()).filter(Boolean));
  if (value === undefined || value === null || value === '') return new Set();
  const ids = Array.isArray(value) ? value : String(value).split(',');
  return new Set(ids.map((id) => String(id).trim()).filter(Boolean));
}
