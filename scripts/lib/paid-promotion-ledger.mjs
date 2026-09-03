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
        .reduce(
          (total, campaign) => total + BigInt(campaign.conversion?.confirmedReceiptsSats ?? '0'),
          0n
        )
        .toString()
    },
    awaitingVerification: awaitingVerification.map((campaign) => ({
      id: campaign.id,
      promoter: campaign.promoter?.handle,
      amountUsd: campaign.compensation?.amountUsd,
      reportedPostUrl: campaign.reportedPostUrl ?? null,
      nextAction: campaign.nextAction,
      recordLiveCommand: `node scripts/paid-promotion-agent.mjs record-live --campaign ${campaign.id} --post ${campaign.reportedPostUrl ?? '<x-status-url>'} --evidence "<live-post-screenshot-or-exported-text>"`
    })),
    nextAction:
      awaitingVerification[0]?.nextAction ??
      liveVerified[0]?.nextAction ??
      completed[0]?.nextAction ??
      ledger.nextAction ??
      'Wait for verified live evidence and measured conversion before repeating paid promotion.',
    boundary:
      'Paid promotion remains chairman-controlled and evidence-gated. This plan does not approve promotion, payment, token grants, repeat spend, or asset movement.'
  };
}

export function recordPaidPromotionVerification({
  ledger,
  campaignId,
  evidence,
  verifiedPostUrl,
  verifiedAtUtc = new Date().toISOString()
}) {
  validatePaidPromotionLedger(ledger);
  const id = cleanLine(campaignId);
  const proof = requireEvidence(evidence, 'Live post verification evidence is required.');
  const postUrl = cleanLine(verifiedPostUrl);
  if (!/^https:\/\/x\.com\/[^/]+\/status\/\d+/i.test(postUrl)) {
    throw new Error('verifiedPostUrl must be an X status URL.');
  }
  parseDate(verifiedAtUtc, 'verifiedAtUtc');
  let found = false;
  const campaigns = (ledger.campaigns ?? []).map((campaign) => {
    if (campaign.id !== id) return campaign;
    found = true;
    if (!['paid-awaiting-post', 'post-reported-unverified'].includes(campaign.status)) {
      throw new Error(
        `${id}: only paid-awaiting-post or post-reported-unverified campaigns can be verified.`
      );
    }
    return {
      ...campaign,
      status: 'live-verified',
      reportedPostUrl: campaign.reportedPostUrl ?? postUrl,
      verifiedPostUrl: postUrl,
      verification: {
        ...campaign.verification,
        status: 'live-verified',
        checkedAtUtc: verifiedAtUtc,
        evidence: proof,
        result:
          'Human verification recorded: post is live, disclosed, unchanged from approved requirements, and ready for conversion measurement.'
      },
      nextAction:
        'Wait 24 hours from the verified post timestamp, then record profile views, clicks, inquiries, invoice requests, and confirmed receipts without approving repeat spend.'
    };
  });
  if (!found) throw new Error(`Paid promotion campaign not found: ${id}`);
  const nextLedger = { ...ledger, updatedAtUtc: verifiedAtUtc, campaigns };
  validatePaidPromotionLedger(nextLedger);
  return nextLedger;
}

export function recordPaidPromotionConversion({
  ledger,
  campaignId,
  evidence,
  profileViewLift,
  trackedClicks,
  serviceInquiries,
  invoiceRequests,
  confirmedReceiptsSats,
  measuredAtUtc = new Date().toISOString()
}) {
  validatePaidPromotionLedger(ledger);
  const id = cleanLine(campaignId);
  const proof = requireEvidence(evidence, 'Conversion measurement evidence is required.');
  parseDate(measuredAtUtc, 'measuredAtUtc');
  const conversion = {
    profileViewLift: cleanLine(profileViewLift || 'not-recorded'),
    trackedClicks: nullableInteger(trackedClicks, 'trackedClicks'),
    serviceInquiries: requiredInteger(serviceInquiries, 'serviceInquiries'),
    invoiceRequests: requiredInteger(invoiceRequests, 'invoiceRequests'),
    confirmedReceiptsSats: cleanIntegerString(
      confirmedReceiptsSats ?? '0',
      'confirmedReceiptsSats'
    ),
    evidence: proof,
    measuredAtUtc
  };
  let found = false;
  const campaigns = (ledger.campaigns ?? []).map((campaign) => {
    if (campaign.id !== id) return campaign;
    found = true;
    if (campaign.status !== 'live-verified') {
      throw new Error(`${id}: conversion recording requires live-verified status.`);
    }
    return {
      ...campaign,
      status: 'completed',
      conversion,
      nextAction:
        BigInt(conversion.confirmedReceiptsSats) > 0n
          ? 'Prepare receipt allocation proposal for confirmed sats before counting reserve progress.'
          : 'Do not repeat paid promotion unless the Executive Chairman approves a new experiment using recorded conversion evidence.'
    };
  });
  if (!found) throw new Error(`Paid promotion campaign not found: ${id}`);
  const nextLedger = { ...ledger, updatedAtUtc: measuredAtUtc, campaigns };
  validatePaidPromotionLedger(nextLedger);
  return nextLedger;
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
    if (
      !cleanLine(campaign.promoter?.handle) ||
      !/^https:\/\/x\.com\//i.test(campaign.promoter?.profileUrl ?? '')
    ) {
      findings.push(`${label}: promoter handle and X profile URL are required`);
    }
    if (campaign.approval?.approvedBy !== 'executive-chairman') {
      findings.push(`${label}: paid promotion requires executive-chairman approval record`);
    }
    if (!/Sponsored \| Paid Partnership/i.test(campaign.approval?.requiredDisclosure ?? '')) {
      findings.push(
        `${label}: campaign approval must require Sponsored | Paid Partnership disclosure`
      );
    }
    if (
      campaign.compensation?.type === 'cash' &&
      !/^\d+(?:\.\d{1,2})?$/.test(campaign.compensation?.amountUsd ?? '')
    ) {
      findings.push(`${label}: cash compensation requires amountUsd`);
    }
    if (
      campaign.compensation?.paymentStatus === 'chairman-reported-paid' &&
      !campaign.reportedPostUrl
    ) {
      findings.push(`${label}: paid campaigns require reportedPostUrl or live evidence`);
    }
    if (
      campaign.status === 'post-reported-unverified' &&
      campaign.verification?.status !== 'needs-human-verification'
    ) {
      findings.push(`${label}: unverified reported posts must require human verification`);
    }
    if (campaign.status === 'live-verified' && !cleanLine(campaign.verification?.evidence)) {
      findings.push(`${label}: live-verified campaigns require verification evidence`);
    }
    if (campaign.status === 'completed' && !cleanLine(campaign.conversion?.evidence)) {
      findings.push(`${label}: completed campaigns require conversion evidence`);
    }
    if (
      campaign.reportedPostUrl &&
      !/^https:\/\/x\.com\/[^/]+\/status\/\d+/i.test(campaign.reportedPostUrl)
    ) {
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
    if (
      /\b(guaranteed buyers|fake engagement|bots|raids|price prediction|investment return)\b/i.test(
        searchableText
      )
    ) {
      findings.push(`${label}: campaign text contains prohibited promotion wording`);
    }
    for (const [index, requirement] of (campaign.approvedContentRequirements ?? []).entries()) {
      const line = cleanLine(requirement);
      const statesProhibition = /^(must not include|no)\b/i.test(line);
      if (
        !statesProhibition &&
        /\b(guaranteed buyers|fake engagement|bots|raids|price prediction|investment return)\b/i.test(
          line
        )
      ) {
        findings.push(
          `${label}: approvedContentRequirements[${index}] contains promotional wording`
        );
      }
    }
  }

  if (findings.length > 0) {
    throw new Error(`Paid promotion ledger is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function requireEvidence(value, message) {
  const evidence = cleanLine(value);
  if (evidence.length < 8) throw new Error(message);
  return evidence;
}

function parseDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime()))
    throw new Error(`${label} must be a valid timestamp.`);
  return date;
}

function nullableInteger(value, label) {
  if (value === undefined || value === null || value === '') return null;
  return requiredInteger(value, label);
}

function requiredInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function cleanIntegerString(value, label) {
  const clean = cleanLine(value);
  if (!/^\d+$/.test(clean)) throw new Error(`${label} must be an integer string.`);
  return clean;
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
