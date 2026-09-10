import { buildReferralPartnerPacket } from '../referral-partner-packet-agent.mjs';

const ALLOWED_STATUSES = new Set([
  'sent-awaiting-response',
  'accepted-awaiting-referred-lead',
  'converted-to-lead',
  'declined',
  'closed-no-response'
]);
const CLOSED_STATUSES = new Set(['converted-to-lead', 'declined', 'closed-no-response']);
const PROHIBITED_PATTERN =
  /\b(pump|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise|market-support|investment return|private key|seed phrase)\b/i;
const PROHIBITED_COMPENSATION_PATTERN =
  /\b(upfront|advance|prepay|prepaid|pay first|payment method|wallet address|send (?:the )?(?:btc|bitcoin|usdc|sol)|token grant|airdrop|transfer now)\b/i;

export function buildReferralPartnerHandoffPlan({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  generatedAtUtc = new Date().toISOString()
}) {
  validateReferralPartnerHandoffQueue(queue);
  const eligibleCampaigns = findEligibleCampaigns({ paidPromotionLedger, referralPartnerPolicy });
  const recordedCampaignIds = new Set((queue.handoffs ?? []).map((handoff) => handoff.sourceCampaignId));
  const candidates = eligibleCampaigns.filter((campaign) => !recordedCampaignIds.has(campaign.id));
  const activeHandoffs = (queue.handoffs ?? []).filter((handoff) => !CLOSED_STATUSES.has(handoff.status));
  const acceptedHandoffs = activeHandoffs.filter(
    (handoff) => handoff.status === 'accepted-awaiting-referred-lead'
  );

  return {
    project: queue.project,
    mode: 'referral-partner-handoff-plan',
    generatedAtUtc,
    totals: {
      eligibleCompletedZeroReceiptCampaigns: eligibleCampaigns.length,
      unrecordedHandoffCandidates: candidates.length,
      activeHandoffs: activeHandoffs.length,
      acceptedAwaitingReferredLead: acceptedHandoffs.length
    },
    candidates: candidates.map((campaign) =>
      buildCandidate({ campaign, referralPartnerPolicy, inboundQueue })
    ),
    activeHandoffs: activeHandoffs.map((handoff) => ({
      id: handoff.id,
      sourceCampaignId: handoff.sourceCampaignId,
      partner: handoff.partner,
      status: handoff.status,
      nextAction: handoff.nextAction,
      recordResponseCommand: `node scripts/referral-partner-handoff-agent.mjs record-response --handoff ${handoff.id} --accepted true --evidence "<partner-response-evidence>" --respondedAtUtc "<responded-at-utc>"`,
      recordLeadCommand: `node scripts/inbound-service-lead-agent.mjs record-lead --lead "<lead-id>" --sourceType manual-referral --sourceId referral-partner-${handoff.partner.id} --contactHandle "<customer-handle-or-contact>" --publicProfileUrl "<https-customer-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --evidence "<referral-and-customer-interest-evidence>" --customerAskedForInvoice false --recordedAtUtc "<recorded-at-utc>" --convertedAtUtc "<converted-at-utc>"`
    })),
    nextAction:
      acceptedHandoffs[0]?.nextAction ??
      activeHandoffs[0]?.nextAction ??
      (candidates[0]
        ? `Send post-receipt referral handoff terms to ${candidates[0].promoter?.displayName}.`
        : queue.nextAction),
    boundary: queue.boundary
  };
}

export function recordReferralHandoffSent({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  campaignId,
  sentEvidence,
  sentAtUtc,
  requestedCompensation = 'post-receipt referral share',
  messageHash = ''
}) {
  validateReferralPartnerHandoffQueue(queue);
  const campaign = findEligibleCampaigns({ paidPromotionLedger, referralPartnerPolicy }).find(
    (candidate) => candidate.id === cleanLine(campaignId)
  );
  if (!campaign) throw new Error(`No eligible completed zero-receipt campaign found: ${campaignId}`);
  const candidate = buildCandidate({ campaign, referralPartnerPolicy, inboundQueue });
  const approvedTermsHash = cleanLine(messageHash);
  if (!/^[a-f0-9]{64}$/.test(approvedTermsHash)) {
    throw new Error('Approved referral handoff terms SHA-256 is required.');
  }
  if (approvedTermsHash !== candidate.packet.termsSha256) {
    throw new Error('Approved referral handoff terms SHA-256 does not match the current packet.');
  }
  const id = `handoff-${campaign.id}`;
  if ((queue.handoffs ?? []).some((handoff) => handoff.id === id || handoff.sourceCampaignId === campaign.id)) {
    throw new Error(`Referral handoff already recorded for campaign: ${campaign.id}`);
  }
  const nextHandoff = {
    id,
    sourceCampaignId: campaign.id,
    partner: {
      id: kebab(campaign.promoter?.displayName || campaign.promoter?.handle),
      displayName: cleanLine(campaign.promoter?.displayName),
      handle: cleanLine(campaign.promoter?.handle),
      profileUrl: cleanUrl(campaign.promoter?.profileUrl, 'partner.profileUrl')
    },
    sourceEvidence: cleanUrl(campaign.verifiedPostUrl ?? campaign.reportedPostUrl, 'sourceEvidence'),
    requestedCompensation: cleanReferralCompensation(requestedCompensation),
    status: 'sent-awaiting-response',
    sentEvidence: requireEvidence(sentEvidence, 'Referral handoff sent evidence is required.'),
    sentAtUtc: parseDate(sentAtUtc, 'sentAtUtc'),
    messageHash: approvedTermsHash,
    approvedTermsSha256: approvedTermsHash,
    nextAction:
      'Record the partner response. If accepted, wait for a referred customer evidence record before invoice review.',
    boundary:
      'This handoff does not approve compensation, invoices, payment instructions, token grants, public posts, or asset movement.'
  };
  const nextQueue = {
    ...queue,
    updatedAtUtc: sentAtUtc,
    handoffs: [...(queue.handoffs ?? []), nextHandoff]
  };
  validateReferralPartnerHandoffQueue(nextQueue);
  return nextQueue;
}

export function recordReferralHandoffResponse({
  queue,
  handoffId,
  accepted,
  evidence,
  respondedAtUtc
}) {
  validateReferralPartnerHandoffQueue(queue);
  const id = cleanLine(handoffId);
  const proof = requireEvidence(evidence, 'Referral handoff response evidence is required.');
  parseDate(respondedAtUtc, 'respondedAtUtc');
  let found = false;
  const handoffs = (queue.handoffs ?? []).map((handoff) => {
    if (handoff.id !== id) return handoff;
    found = true;
    if (handoff.status !== 'sent-awaiting-response') {
      throw new Error(`${id}: response can only be recorded for sent-awaiting-response handoffs.`);
    }
    const didAccept = /^true$/i.test(String(accepted));
    return {
      ...handoff,
      status: didAccept ? 'accepted-awaiting-referred-lead' : 'declined',
      responseEvidence: proof,
      respondedAtUtc,
      nextAction: didAccept
        ? 'Record any referred customer as an inbound manual-referral lead before invoice review.'
        : 'Close this handoff unless the partner later sends a qualified customer referral.'
    };
  });
  if (!found) throw new Error(`Referral handoff not found: ${id}`);
  const nextQueue = { ...queue, updatedAtUtc: respondedAtUtc, handoffs };
  validateReferralPartnerHandoffQueue(nextQueue);
  return nextQueue;
}

export function recordReferralHandoffLeadConversion({
  queue,
  sourceId,
  leadId,
  evidence,
  convertedAtUtc
}) {
  validateReferralPartnerHandoffQueue(queue);
  const referralSourceId = cleanLine(sourceId);
  const convertedLeadId = kebab(leadId);
  if (!convertedLeadId) throw new Error('Converted referral lead id is required.');
  const proof = requireEvidence(evidence, 'Referred lead evidence is required.');
  parseDate(convertedAtUtc, 'convertedAtUtc');
  let converted = false;
  const handoffs = (queue.handoffs ?? []).map((handoff) => {
    const handoffSourceId = `referral-partner-${handoff.partner?.id}`;
    if (handoffSourceId !== referralSourceId || handoff.status !== 'accepted-awaiting-referred-lead') {
      return handoff;
    }
    converted = true;
    return {
      ...handoff,
      status: 'converted-to-lead',
      referredLeadId: convertedLeadId,
      referredLeadEvidence: proof,
      convertedAtUtc,
      nextAction:
        'Track the referred inbound lead through intake, chairman invoice review, confirmed receipt, and post-receipt compensation proposal.'
    };
  });
  if (!converted) return queue;
  const nextQueue = { ...queue, updatedAtUtc: convertedAtUtc, handoffs };
  validateReferralPartnerHandoffQueue(nextQueue);
  return nextQueue;
}

export function validateReferralPartnerHandoffQueue(queue) {
  const findings = [];
  if (!queue || typeof queue !== 'object') findings.push('queue is required');
  if (queue?.schemaVersion !== 1) findings.push('schemaVersion must be 1');
  if (queue?.mode !== 'referral-partner-handoff-control') {
    findings.push('mode must be referral-partner-handoff-control');
  }
  if (!/reserve|sats/i.test(queue?.objective ?? '')) {
    findings.push('objective must preserve reserve-sats revenue objective');
  }
  if (queue?.policy?.sourceCampaignMustBeCompleted !== true) {
    findings.push('policy must require completed source campaigns');
  }
  if (queue?.policy?.requiresZeroConfirmedReceiptSats !== true) {
    findings.push('policy must require zero confirmed receipt sats');
  }
  if (queue?.policy?.requiresApprovedReferralPolicy !== true) {
    findings.push('policy must require approved referral policy');
  }
  if (queue?.policy?.paymentInstructionsAllowed !== false) {
    findings.push('policy must block payment instructions');
  }
  if (queue?.policy?.upfrontCompensationAllowed !== false) {
    findings.push('policy must block upfront compensation');
  }
  if (queue?.policy?.assetMovementAllowed !== false) {
    findings.push('policy must block asset movement');
  }
  if (!/separate Executive Chairman approval/i.test(queue?.policy?.requiredBoundary ?? '')) {
    findings.push('policy.requiredBoundary must preserve separate chairman approval');
  }
  for (const required of ALLOWED_STATUSES) {
    if (!(queue?.handoffStatuses ?? []).includes(required)) {
      findings.push(`handoffStatuses missing ${required}`);
    }
  }
  for (const required of ['id', 'sourceCampaignId', 'partner', 'sourceEvidence', 'status', 'sentEvidence', 'sentAtUtc', 'nextAction']) {
    if (!(queue?.requiredHandoffFields ?? []).includes(required)) {
      findings.push(`requiredHandoffFields missing ${required}`);
    }
  }
  const ids = new Set();
  const sourceCampaignIds = new Set();
  for (const handoff of queue?.handoffs ?? []) {
    const label = handoff.id ?? '<missing-handoff>';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label)) findings.push(`${label}: id must be kebab-case`);
    if (ids.has(label)) findings.push(`${label}: duplicate handoff id`);
    ids.add(label);
    if (sourceCampaignIds.has(handoff.sourceCampaignId)) {
      findings.push(`${label}: duplicate sourceCampaignId`);
    }
    sourceCampaignIds.add(handoff.sourceCampaignId);
    for (const field of queue.requiredHandoffFields ?? []) {
      if (field === 'partner') {
        if (!handoff.partner || typeof handoff.partner !== 'object') findings.push(`${label}: missing partner`);
      } else if (!cleanLine(handoff[field])) {
        findings.push(`${label}: missing ${field}`);
      }
    }
    if (!ALLOWED_STATUSES.has(handoff.status)) findings.push(`${label}: unsupported status ${handoff.status}`);
    if (!/^https?:\/\/\S+$/i.test(handoff.sourceEvidence ?? '')) {
      findings.push(`${label}: sourceEvidence must be an http(s) URL`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handoff.partner?.id ?? '')) {
      findings.push(`${label}: partner.id must be kebab-case`);
    }
    if (handoff.approvedTermsSha256 && !/^[a-f0-9]{64}$/.test(handoff.approvedTermsSha256)) {
      findings.push(`${label}: approvedTermsSha256 must be a SHA-256 hex digest`);
    }
    if (handoff.approvedTermsSha256 && handoff.messageHash !== handoff.approvedTermsSha256) {
      findings.push(`${label}: messageHash must match approvedTermsSha256`);
    }
    for (const [field, status] of [
      ['sentAtUtc', null],
      ['respondedAtUtc', ['accepted-awaiting-referred-lead', 'converted-to-lead', 'declined']],
      ['convertedAtUtc', ['converted-to-lead']]
    ]) {
      if (field in handoff && cleanLine(handoff[field])) {
        try {
          parseDate(handoff[field], `${label}.${field}`);
        } catch (error) {
          findings.push(error.message);
        }
      } else if (status?.includes(handoff.status)) {
        findings.push(`${label}: ${field} must be a valid timestamp.`);
      }
    }
    try {
      cleanReferralCompensation(handoff.requestedCompensation);
    } catch (error) {
      findings.push(`${label}: ${error.message}`);
    }
    assertNoUnsafePositiveClaims(
      [handoff.sentEvidence, handoff.responseEvidence, handoff.nextAction, handoff.boundary].join('\n'),
      `${label}: handoff text`,
      findings
    );
  }
  if (!/does not approve any partner/i.test(queue?.boundary ?? '')) {
    findings.push('boundary must block partner approval');
  }
  if (findings.length > 0) {
    throw new Error(`Referral partner handoff queue is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function buildCandidate({ campaign, referralPartnerPolicy, inboundQueue }) {
  const partnerId = kebab(campaign.promoter?.displayName || campaign.promoter?.handle);
  const displayName = cleanLine(campaign.promoter?.displayName);
  const handle = cleanLine(campaign.promoter?.handle);
  const packet = buildReferralPartnerPacket({
    policy: referralPartnerPolicy,
    inboundQueue,
    partnerId,
    displayName,
    handle,
    sourceEvidence: campaign.verifiedPostUrl ?? campaign.reportedPostUrl,
    requestedCompensation: 'post-receipt referral share'
  });
  return {
    sourceCampaignId: campaign.id,
    partner: {
      id: partnerId,
      displayName,
      handle,
      profileUrl: campaign.promoter?.profileUrl
    },
    sourceEvidence: campaign.verifiedPostUrl ?? campaign.reportedPostUrl,
    renderPacketCommand: `node scripts/referral-partner-handoff-agent.mjs render --campaign ${campaign.id}`,
    writePacketCommand: `node scripts/referral-partner-handoff-agent.mjs write-packet --campaign ${campaign.id}`,
    recordSentCommand: `node scripts/referral-partner-handoff-agent.mjs record-sent --campaign ${campaign.id} --evidence "<partner-terms-send-evidence>" --sentAtUtc "<sent-at-utc>" --messageHash ${packet.termsSha256}`,
    packet
  };
}

function findEligibleCampaigns({ paidPromotionLedger, referralPartnerPolicy }) {
  if (referralPartnerPolicy?.status !== 'approved-by-chairman') return [];
  return (paidPromotionLedger?.campaigns ?? []).filter(
    (campaign) =>
      campaign.status === 'completed' &&
      BigInt(campaign.conversion?.confirmedReceiptsSats ?? '0') === 0n &&
      cleanLine(campaign.promoter?.handle) &&
      /^https:\/\/x\.com\//i.test(campaign.promoter?.profileUrl ?? '') &&
      /^https:\/\/x\.com\/[^/]+\/status\/\d+/i.test(campaign.verifiedPostUrl ?? campaign.reportedPostUrl ?? '')
  );
}

function assertNoUnsafePositiveClaims(text, label, findings) {
  const cleaned = cleanLine(text).replace(
    /\b(no|not|without|do not|must not|does not|block(?:s)?|before separate Executive Chairman approval)[^.;\n]*(?:price guarantee|redemption promise|market-support|guaranteed buyers|fake engagement|bots|raids|investment return|payment instruction|asset movement|token grant|compensation)[^.;\n]*/gi,
    ''
  );
  if (PROHIBITED_PATTERN.test(cleaned)) findings.push(`${label} contains prohibited operating language`);
}

function cleanUrl(value, label) {
  const cleaned = cleanLine(value);
  if (!/^https?:\/\/\S+$/i.test(cleaned)) throw new Error(`${label} must be an http(s) URL.`);
  return cleaned;
}

function requireEvidence(value, message) {
  const evidence = cleanLine(value);
  if (evidence.length < 8) throw new Error(message);
  return evidence;
}

function cleanReferralCompensation(value) {
  const compensation = cleanLine(value || 'post-receipt referral share');
  if (!/post-receipt|after (?:the )?(?:referred )?customer pays|after .*receipt/i.test(compensation)) {
    throw new Error('requestedCompensation must be post-receipt only.');
  }
  if (PROHIBITED_COMPENSATION_PATTERN.test(compensation)) {
    throw new Error('requestedCompensation must not include upfront payment, payment instructions, token grants, or immediate transfer language.');
  }
  return compensation;
}

function parseDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return value;
}

function kebab(value) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
