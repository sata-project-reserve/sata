export function buildProspectReviewPacket({ pipeline, generatedAtUtc = new Date().toISOString() }) {
  if (!pipeline) throw new Error('Missing prospect pipeline.');

  const batchSize = Number(pipeline.dailyCadence?.chairmanReviewBatchSize ?? 3);
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error('dailyCadence.chairmanReviewBatchSize must be an integer >= 1.');
  }

  const candidates = (pipeline.prospects ?? [])
    .filter((prospect) => prospect.stage === 'identified')
    .slice(0, batchSize);

  return {
    project: pipeline.project,
    mode: 'chairman-prospect-review-packet',
    generatedAtUtc,
    activeCycleId: pipeline.activeCycleId,
    primaryOfferId: pipeline.primaryOfferId,
    candidateCount: candidates.length,
    candidates: candidates.map((prospect) => ({
      id: prospect.id,
      publicProfileUrl: prospect.publicProfileUrl,
      projectUrl: prospect.projectUrl,
      observedClaim: prospect.observedClaim,
      recommendedOfferId: prospect.recommendedOfferId,
      evidence: prospect.evidence,
      proposedNextStage: 'chairman-review',
      requiredApproval:
        'Executive Chairman must approve this prospect before outreach, invoice, paid work, token grant, or public commitment.'
    })),
    recommendedDecision:
      candidates.length > 0
        ? 'Review the listed candidates and choose which may move to chairman-review for a later explicit outreach decision.'
        : 'Identify more public-evidence candidates before outreach.',
    boundary:
      'This packet is a review aid only. It does not approve contact, invoices, payment requests, paid work, token grants, or asset movement.'
  };
}

export function renderProspectReviewPacket({ pipeline, generatedAtUtc }) {
  const packet = buildProspectReviewPacket({ pipeline, generatedAtUtc });
  const lines = [
    '# SATA Prospect Review Packet',
    '',
    `Project: ${packet.project}`,
    `Cycle: ${packet.activeCycleId}`,
    `Generated: ${packet.generatedAtUtc}`,
    `Primary offer: ${packet.primaryOfferId}`,
    `Candidates: ${packet.candidateCount}`,
    '',
    '## Candidates'
  ];

  if (packet.candidates.length === 0) {
    lines.push('', '- No identified candidates are available for review.');
  }

  for (const candidate of packet.candidates) {
    lines.push(
      '',
      `### ${candidate.id}`,
      '',
      `- Profile: ${candidate.publicProfileUrl}`,
      `- Project: ${candidate.projectUrl}`,
      `- Observed public claim: ${candidate.observedClaim}`,
      `- Recommended offer: ${candidate.recommendedOfferId}`,
      `- Proposed next stage: ${candidate.proposedNextStage}`,
      `- Required approval: ${candidate.requiredApproval}`,
      `- Evidence: ${candidate.evidence.join(', ')}`
    );
  }

  lines.push('', '## Decision', '', packet.recommendedDecision, '', '## Boundary', '', packet.boundary);

  return lines.join('\n');
}
