const ALLOWED_STATUSES = new Set([
  'proposed',
  'approved-not-paid',
  'paid-awaiting-post',
  'post-reported-unverified',
  'live-verified',
  'completed',
  'cancelled',
  'failed-refund-requested'
]);

const PROHIBITED_PATTERN =
  /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support|investment return)\b/i;

export function buildPaidPromotionPlan({ ledger, generatedAtUtc = new Date().toISOString() }) {
  validatePaidPromotionLedger(ledger);
  const campaigns = ledger.campaigns ?? [];
  const awaitingVerification = campaigns.filter((campaign) =>
    ['paid-awaiting-post', 'post-reported-unverified'].includes(campaign.status)
  );
  const liveVerified = campaigns.filter((campaign) => campaign.status === 'live-verified');
  const completed = campaigns.filter((campaign) => campaign.status === 'completed');

  return {
    project: ledger.project,
    mode: 'paid-promotion-control-plan',
    generatedAtUtc,
    totals: {
      campaigns: campaigns.length,
      awaitingVerification: awaitingVerification.length,
      liveVerified: liveVerified.length,
      completed: completed.length,
      confirmedReceiptsSats: campaigns
        .reduce((total, campaign) => total + BigInt(campaign.conversion?.confirmedReceiptsSats ?? '0'), 0n)
        .toString()
    },
    awaitingVerification: awaitingVerification.map((campaign) => ({
      id: campaign.id,
      promoter: campaign.promoter?.handle,
      amountUsd: campaign.compensation?.amountUsd,
      reportedPostUrl: campaign.reportedPostUrl ?? null,
      nextAction: campaign.nextAction
    })),
    nextAction:
      awaitingVerification[0]?.nextAction ??
      ledger.nextAction ??
      'Wait for verified live evidence and measured conversion before repeating paid promotion.',
    boundary:
      'Paid promotion remains chairman-controlled and evidence-gated. This plan does not approve promotion, payment, token grants, repeat spend, or asset movement.'
  };
}

export function validatePaidPromotionLedger(ledger) {
  const findings = [];
  if (!ledger || typeof ledger !== 'object') findings.push('ledger is required');
  if (!ledger?.project) findings.push('project is required');
  if (ledger?.mode !== 'paid-promotion-control-ledger') {
    findings.push('mode must be paid-promotion-control-ledger');
  }
  if (ledger?.policy?.chairmanApprovalRequired !== true) {
    findings.push('policy.chairmanApprovalRequired must be true');
  }
  if (!/Sponsored \| Paid Partnership/i.test(ledger?.policy?.requiredDisclosure ?? '')) {
    findings.push('policy.requiredDisclosure must require Sponsored | Paid Partnership');
  }
  if (!/live evidence/i.test(ledger?.policy?.repeatSpendRule ?? '')) {
    findings.push('policy.repeatSpendRule must require live evidence before repeat spend');
  }
  if (PROHIBITED_PATTERN.test(ledger?.boundary ?? '')) {
    findings.push('boundary contains prohibited promotion wording');
  }

  const ids = new Set();
  for (const campaign of ledger?.campaigns ?? []) {
    const label = campaign.id ?? '<missing-id>';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label)) {
      findings.push(`${label}: id must be kebab-case`);
    }
    if (ids.has(label)) findings.push(`${label}: duplicate campaign id`);
    ids.add(label);
    if (!ALLOWED_STATUSES.has(campaign.status)) {
      findings.push(`${label}: unsupported status ${campaign.status}`);
    }
    if (!cleanLine(campaign.promoter?.handle) || !/^https:\/\/x\.com\//i.test(campaign.promoter?.profileUrl ?? '')) {
      findings.push(`${label}: promoter handle and X profile URL are required`);
    }
    if (campaign.approval?.approvedBy !== 'executive-chairman') {
      findings.push(`${label}: paid promotion requires executive-chairman approval record`);
    }
    if (!/Sponsored \| Paid Partnership/i.test(campaign.approval?.requiredDisclosure ?? '')) {
      findings.push(`${label}: campaign approval must require Sponsored | Paid Partnership disclosure`);
    }
    if (campaign.compensation?.type === 'cash' && !/^\d+(?:\.\d{1,2})?$/.test(campaign.compensation?.amountUsd ?? '')) {
      findings.push(`${label}: cash compensation requires amountUsd`);
    }
    if (campaign.compensation?.paymentStatus === 'chairman-reported-paid' && !campaign.reportedPostUrl) {
      findings.push(`${label}: paid campaigns require reportedPostUrl or live evidence`);
    }
    if (campaign.status === 'post-reported-unverified' && campaign.verification?.status !== 'needs-human-verification') {
      findings.push(`${label}: unverified reported posts must require human verification`);
    }
    if (campaign.status === 'live-verified' && !cleanLine(campaign.verification?.evidence)) {
      findings.push(`${label}: live-verified campaigns require verification evidence`);
    }
    if (campaign.reportedPostUrl && !/^https:\/\/x\.com\/[^/]+\/status\/\d+/i.test(campaign.reportedPostUrl)) {
      findings.push(`${label}: reportedPostUrl must be an X status URL`);
    }
    if (!/^\d+$/.test(campaign.conversion?.confirmedReceiptsSats ?? '0')) {
      findings.push(`${label}: confirmedReceiptsSats must be an integer string`);
    }
    const requirements = (campaign.approvedContentRequirements ?? []).join('\n');
    for (const required of [
      /Sponsored \| Paid Partnership/i,
      /transparency report/i,
      /no price guarantee/i,
      /liquidity risk|liquidity can/i
    ]) {
      if (!required.test(requirements)) {
        findings.push(`${label}: approvedContentRequirements missing ${required}`);
      }
    }
    const searchableText = [campaign.nextAction, campaign.verification?.result].join('\n');
    if (/\b(guaranteed buyers|fake engagement|bots|raids|price prediction|investment return)\b/i.test(searchableText)) {
      findings.push(`${label}: campaign text contains prohibited promotion wording`);
    }
    for (const [index, requirement] of (campaign.approvedContentRequirements ?? []).entries()) {
      const line = cleanLine(requirement);
      const statesProhibition = /^(must not include|no)\b/i.test(line);
      if (
        !statesProhibition &&
        /\b(guaranteed buyers|fake engagement|bots|raids|price prediction|investment return)\b/i.test(line)
      ) {
        findings.push(`${label}: approvedContentRequirements[${index}] contains promotional wording`);
      }
    }
  }

  if (findings.length > 0) {
    throw new Error(`Paid promotion ledger is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
