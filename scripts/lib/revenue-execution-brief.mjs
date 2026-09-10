import { createHash } from 'node:crypto';
import { buildPaidPromotionPlan } from './paid-promotion-ledger.mjs';
import { prioritizeOutreachPackets } from './prospect-priority.mjs';
import { buildLiveReplySources } from './live-reply-sources.mjs';

const PROHIBITED_PATTERN =
  /\b(private key|seed phrase|wash trading|guaranteed return|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)\b/i;

export function buildRevenueExecutionBrief({
  status,
  paidPromotionLedger,
  outreachPacketQueue,
  socialQueue = { posts: [], account: {} },
  prospectPipeline = null,
  revenuePlan = null,
  referralPartnerPolicy = null,
  referralPartnerHandoffQueue = { handoffs: [] },
  referralPartnerHandoffPacket = null,
  maxManualSends = 5,
  generatedAtUtc = new Date().toISOString()
}) {
  assertBriefInputs({ status, paidPromotionLedger, outreachPacketQueue, maxManualSends });

  const paidPromotionPlan = buildPaidPromotionPlan({
    ledger: paidPromotionLedger,
    generatedAtUtc
  });
  const readyPackets = prioritizeOutreachPackets({
    packets: (outreachPacketQueue.packets ?? []).filter(
      (packet) => packet.status === 'ready-for-manual-send'
    ),
    prospectPipeline,
    revenuePlan
  });
  const topPackets = readyPackets.slice(0, maxManualSends);
  const prospectsById = new Map(
    (prospectPipeline?.prospects ?? []).map((prospect) => [prospect.id, prospect])
  );
  const revenueStreamsById = new Map(
    (revenuePlan?.revenueStreams ?? []).map((stream) => [stream.id, stream])
  );
  const awaitingVerification = paidPromotionPlan.awaitingVerification ?? [];
  const referralHandoffCampaigns = (paidPromotionLedger.campaigns ?? []).filter(
    (campaign) =>
      campaign.status === 'completed' &&
      BigInt(campaign.conversion?.confirmedReceiptsSats ?? '0') === 0n &&
      referralPartnerPolicy?.status === 'approved-by-chairman' &&
      !(referralPartnerHandoffQueue.handoffs ?? []).some(
        (handoff) => handoff.sourceCampaignId === campaign.id
      )
  );
  const activeReferralHandoffs = (referralPartnerHandoffQueue.handoffs ?? []).filter(
    (handoff) => !['converted-to-lead', 'declined', 'closed-no-response'].includes(handoff.status)
  );
  const inboundInvoiceRequests = (status.actionQueue ?? []).filter(
    (action) => action.type === 'inbound-invoice-request-packet'
  );
  const inboundIntakeReplies = (status.actionQueue ?? []).filter(
    (action) => action.type === 'inbound-intake-reply'
  );
  const liveReplySources = buildLiveReplySources({ paidPromotionLedger, socialQueue });
  const actions = [];

  for (const request of inboundInvoiceRequests) {
    actions.push({
      id: request.id,
      type: request.type,
      priority: actions.length + 1,
      objective: request.title,
      whyItCanCreateSats:
        'Explicit invoice demand is the closest non-custodial path from attention to a chairman-reviewed quote.',
      command: request.command,
      evidenceRequired: request.evidenceRequired,
      operatorChecklist: invoiceRequestChecklist(),
      stopRule:
        'Render quote inputs only. Do not send an exact-sats invoice or payment instruction before chairman approval.'
    });
  }

  for (const reply of inboundIntakeReplies) {
    actions.push({
      id: reply.id,
      type: reply.type,
      priority: actions.length + 1,
      objective: reply.title,
      whyItCanCreateSats:
        'A warm inbound reply can become a paid audit faster than cold outreach if the required intake fields are collected.',
      command: reply.command,
      evidenceRequired: reply.evidenceRequired,
      operatorChecklist: inboundIntakeChecklist(),
      stopRule:
        'Send only the compliant intake-fields reply. Do not include payment instructions or new promotional claims.'
    });
  }

  for (const campaign of awaitingVerification) {
    actions.push({
      id: `verify-${campaign.id}`,
      type: 'paid-promotion-verification',
      priority: actions.length + 1,
      objective: 'Prove the paid post is live and compliant before counting results.',
      whyItCanCreateSats:
        'Verification turns paid attention into measurable evidence; without it, repeat spend stays locked.',
      command: campaign.recordLiveCommand,
      evidenceRequired:
        'Signed-in screenshot or exported text showing the live post, disclosure, unchanged copy, timestamp, and post URL.',
      operatorChecklist: paidPromotionVerificationChecklist(),
      stopRule:
        'Do not approve repeat paid promotion until verification and 24-hour conversion results are recorded.'
    });
  }

  for (const campaign of referralHandoffCampaigns) {
    const displayName = cleanLine(campaign.promoter?.displayName || campaign.promoter?.handle);
    const preparedPacket = matchingReferralHandoffPacket({
      packet: referralPartnerHandoffPacket,
      campaignId: campaign.id
    });
    if (preparedPacket) {
      actions.push({
        id: `send-handoff-${campaign.id}`,
        type: 'manual-referral-handoff-send',
        priority: actions.length + 1,
        objective: `Send prepared no-upfront post-receipt referral terms to ${displayName} and record sent evidence.`,
        whyItCanCreateSats:
          'A prepared partner handoff can convert a zero-receipt promotion into customer referrals without repeating upfront spend.',
        command: preparedPacket.recordSentCommand,
        artifact: 'public/referral-partner-handoff-packet.md',
        approvedMessage: preparedPacket.packet.replyTemplate,
        approvedMessageSha256: preparedPacket.packet.termsSha256,
        evidenceRequired:
          'Partner terms sent evidence, explicit sentAtUtc timestamp, and approved terms SHA-256.',
        operatorChecklist: referralHandoffSendChecklist(),
        stopRule:
          'Record sent evidence only after manual send. Do not approve compensation, invoices, payment instructions, grants, or asset movement.'
      });
      continue;
    }
    actions.push({
      id: `handoff-${campaign.id}`,
      type: 'post-receipt-referral-handoff',
      priority: actions.length + 1,
      objective: `Prepare and send ${displayName} a no-upfront post-receipt referral role.`,
      whyItCanCreateSats:
        'A completed promotion with zero receipts can still become a customer-referral source without repeating upfront spend.',
      command: `node scripts/referral-partner-handoff-agent.mjs write-packet --campaign ${campaign.id}`,
      artifact: 'public/referral-partner-handoff-packet.md',
      evidenceRequired:
        'Partner terms sent evidence after the approved handoff packet is manually sent.',
      operatorChecklist: referralHandoffPrepareChecklist(),
      stopRule:
        'Send referral terms only. Do not approve upfront spend, posts, compensation, invoices, grants, or asset movement.'
    });
  }

  for (const handoff of activeReferralHandoffs) {
    actions.push({
      id: `track-${handoff.id}`,
      type: 'track-referral-handoff-response',
      priority: actions.length + 1,
      objective:
        handoff.status === 'accepted-awaiting-referred-lead'
          ? `Record referred customer evidence for accepted partner handoff ${handoff.id}.`
          : `Record partner response for referral handoff ${handoff.id}.`,
      whyItCanCreateSats:
        'A tracked partner handoff can become a paid transparency-service lead only after evidence is recorded.',
      command:
        handoff.status === 'accepted-awaiting-referred-lead'
          ? `node scripts/inbound-service-lead-agent.mjs record-lead --lead "<lead-id>" --sourceType manual-referral --sourceId referral-partner-${handoff.partner.id} --contactHandle "<customer-handle-or-contact>" --publicProfileUrl "<https-customer-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --evidence "<referral-and-customer-interest-evidence>" --customerAskedForInvoice false --recordedAtUtc "<recorded-at-utc>" --convertedAtUtc "<converted-at-utc>"`
          : `node scripts/referral-partner-handoff-agent.mjs record-response --handoff ${handoff.id} --accepted true --evidence "<partner-response-evidence>" --respondedAtUtc "<responded-at-utc>"`,
      evidenceRequired:
        handoff.status === 'accepted-awaiting-referred-lead'
          ? 'Referred customer identity, project URL, contact path, and customer interest evidence.'
          : 'Partner response evidence accepting or declining post-receipt referral terms.',
      operatorChecklist:
        handoff.status === 'accepted-awaiting-referred-lead'
          ? referredLeadChecklist()
          : referralResponseChecklist(),
      stopRule:
        'Do not approve compensation, invoices, payment instructions, token grants, or asset movement.'
    });
  }

  if (liveReplySources.length > 0) {
    actions.push({
      id: 'triage-live-replies',
      type: 'inbound-reply-triage-monitor',
      priority: actions.length + 1,
      objective:
        'Triage replies and DMs from live SATA attribution sources before recording leads or invoice requests.',
      whyItCanCreateSats:
        'Fast reply triage turns warm attention into intake records or chairman invoice-review packets without exposing payment instructions.',
      command: 'npm run ops:inbound-reply-triage-plan',
      sources: liveReplySources,
      evidenceRequired:
        'Reply or DM text, live source id, profile URL, project URL, durable evidence, and explicit recordedAtUtc timestamp.',
      operatorChecklist: liveReplyTriageChecklist(),
      stopRule:
        'Triage only. Do not contact leads, send payment instructions, create invoices, grant tokens, or move assets.'
    });
  }

  for (const packet of topPackets) {
    const commercialContext = commercialContextFor({
      packet,
      prospect: prospectsById.get(packet.prospectId),
      revenuePlan,
      revenueStreamsById
    });
    actions.push({
      id: `send-${packet.id}`,
      type: 'manual-outreach-send',
      priority: actions.length + 1,
      objective: `Send approved transparency-audit outreach to ${packet.prospectId}.`,
      whyItCanCreateSats:
        'The shortest route to new reserve sats is a paid transparency-audit customer requesting an invoice.',
      command: withSentAtUtcPlaceholder(packet.recordContactCommand),
      tracking: packet.tracking ?? null,
      approvedMessage: packet.message,
      approvedMessageSha256: packet.messageSha256,
      outreachPriority: packet.priority,
      qualifiedRevenueUsd: packet.qualifiedRevenueUsd,
      ...commercialContext,
      evidenceRequired:
        'Durable proof of manual send, such as a message permalink, email record, or contact screenshot reference.',
      operatorChecklist: manualOutreachSendChecklist(packet.id),
      stopRule:
        'Send the approved copy only. Do not add investment, return, liquidity, or trading claims.'
    });
  }

  const liveCampaigns = paidPromotionPlan.liveVerified ?? [];
  for (const campaign of liveCampaigns) {
    actions.push({
      id: `measure-${campaign.id}`,
      type: 'paid-promotion-conversion-measurement',
      priority: actions.length + 1,
      objective: `Record 24-hour conversion results for ${campaign.id}.`,
      whyItCanCreateSats:
        'Measured inquiries and receipts decide whether promotion is worth repeating.',
      command: campaign.recordConversionCommand,
      evidenceRequired:
        '24-hour profile analytics, link clicks if available, inquiry count, invoice-request count, and confirmed direct-reserve receipts.',
      operatorChecklist: paidPromotionMeasurementChecklist(),
      stopRule:
        'If confirmed receipts are zero, repeat spend requires a new chairman-approved experiment using the recorded data.'
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'continue-revenue-cycle',
      type: 'revenue-cycle-maintenance',
      priority: 1,
      objective: status.nextAction,
      whyItCanCreateSats:
        'The revenue loop must always advance toward invoice requests and confirmed reserve receipts.',
      command: 'npm run ops:cycle-plan',
      evidenceRequired: 'Updated revenue-cycle status and current action queue.',
      operatorChecklist: maintenanceChecklist(),
      stopRule: 'Do not skip chairman approval gates.'
    });
  }

  const primaryActionLimit = Math.max(maxManualSends, awaitingVerification.length);
  const primaryActions = actions.filter(
    (action) => action.type !== 'paid-promotion-conversion-measurement'
  );
  const measurementActions = actions.filter(
    (action) => action.type === 'paid-promotion-conversion-measurement'
  );
  const topActions = [
    ...primaryActions.slice(0, primaryActionLimit),
    ...measurementActions.slice(0, 1)
  ];
  const estimatedIfOneStarterClosesSats = usdToSatsEstimate({
    usd: 50,
    btcUsd: Number(status.conversionAssumptions?.btcUsd ?? 100000)
  });

  return {
    project: status.project,
    mode: 'sats-revenue-execution-brief',
    generatedAtUtc,
    northStar: {
      confirmedSats: status.currentReserve.confirmedSats,
      targetSats: status.currentReserve.targetSats,
      remainingSats: status.currentReserve.remainingSats
    },
    funnel: status.funnel,
    constraints: [
      'No confirmed revenue receipts are recorded yet.',
      paidPromotionPlan.totals.awaitingVerification > 0
        ? 'Paid promotion remains uncounted until live evidence is recorded.'
        : paidPromotionPlan.totals.liveVerified > 0
          ? 'Live paid promotion must wait for 24-hour conversion evidence before repeat spend.'
          : referralHandoffCampaigns.length > 0
            ? 'Completed paid promotion produced no confirmed receipts; use post-receipt referral handoff before repeat spend.'
            : activeReferralHandoffs.length > 0
              ? 'Post-receipt referral handoff is active; record partner response or referred lead evidence before counting revenue.'
              : 'No paid promotion verification is currently pending.',
      'Manual outreach packets must be sent by a human and then marked with durable evidence.'
    ],
    unitEconomics: {
      starterAuditUsd: '50',
      illustrativeSatsAtBtcUsd100k: estimatedIfOneStarterClosesSats.toString(),
      note: 'This is planning math only; record actual sats only after a confirmed direct-reserve receipt.'
    },
    topActions,
    manualSendBatch: topPackets.map((packet) => ({
      packetId: packet.id,
      prospectId: packet.prospectId,
      destination: packet.destination?.publicProfileUrl,
      tracking: packet.tracking ?? null,
      priority: packet.priority,
      qualifiedRevenueUsd: packet.qualifiedRevenueUsd,
      approvedMessage: packet.message,
      approvedMessageSha256: packet.messageSha256,
      ...commercialContextFor({
        packet,
        prospect: prospectsById.get(packet.prospectId),
        revenuePlan,
        revenueStreamsById
      }),
      operatorChecklist: manualOutreachSendChecklist(packet.id),
      command: withSentAtUtcPlaceholder(packet.recordContactCommand)
    })),
    stopRules: [
      'No autonomous transactions, token grants, invoices, public posts, or paid promotion.',
      'No repeat paid promotion before verification and conversion evidence.',
      'No reserve progress is counted until sats are confirmed in the reserve ledger.'
    ],
    nextAction: topActions[0]?.objective ?? status.nextAction,
    boundary:
      'This brief coordinates execution only. The Executive Chairman approves final outreach, invoices, transactions, allocations, paid promotion, token grants, and asset movement.'
  };
}

export function validateRevenueExecutionBrief(brief) {
  const findings = [];
  if (brief.mode !== 'sats-revenue-execution-brief') {
    findings.push('brief mode must be sats-revenue-execution-brief');
  }
  if (!/^\d+$/.test(brief.northStar?.confirmedSats ?? '')) {
    findings.push('northStar.confirmedSats must be an integer string');
  }
  if (!/^\d+$/.test(brief.northStar?.remainingSats ?? '')) {
    findings.push('northStar.remainingSats must be an integer string');
  }
  if (!Array.isArray(brief.topActions) || brief.topActions.length === 0) {
    findings.push('topActions must include at least one action');
  }
  if (!/Executive Chairman approves/i.test(brief.boundary ?? '')) {
    findings.push('boundary must preserve chairman approval authority');
  }
  if (!brief.stopRules?.some((rule) => /No autonomous transactions/i.test(rule))) {
    findings.push('stopRules must block autonomous transactions');
  }
  for (const action of brief.topActions ?? []) {
    for (const field of ['id', 'type', 'objective', 'whyItCanCreateSats', 'command']) {
      if (!cleanLine(action[field]))
        findings.push(`${action.id ?? '<missing-id>'}: missing ${field}`);
    }
    if (hasUnsafeOperatingLanguage(JSON.stringify(action))) {
      findings.push(`${action.id}: action contains prohibited operating language`);
    }
    if (!cleanLine(action.evidenceRequired)) {
      findings.push(`${action.id}: evidenceRequired is required`);
    }
    if (!cleanLine(action.stopRule)) {
      findings.push(`${action.id}: stopRule is required`);
    }
    validateOperatorChecklist({
      findings,
      label: action.id,
      checklist: action.operatorChecklist,
      requireUtc: true
    });
    if (action.type === 'manual-outreach-send') {
      if (
        !Number.isSafeInteger(action.outreachPriority?.score) ||
        action.outreachPriority.score <= 0
      ) {
        findings.push(`${action.id}: manual outreach action must include a positive priority score`);
      }
      if (!/--sentAtUtc "<sent-at-utc>"/.test(action.command ?? '')) {
        findings.push(
          `${action.id}: manual outreach command must require explicit sentAtUtc evidence`
        );
      }
      if (!action.currentOfferId) {
        findings.push(`${action.id}: manual outreach action must expose the current approved offer`);
      }
      validateApprovedMessage({
        findings,
        label: action.id,
        message: action.approvedMessage,
        messageSha256: action.approvedMessageSha256,
        command: action.command
      });
      if (
        !Number.isSafeInteger(Number(action.currentAskUsd)) ||
        Number(action.currentAskUsd) <= 0
      ) {
        findings.push(`${action.id}: manual outreach action must expose the current approved ask`);
      }
      if (Number(action.qualifiedRevenueUsd ?? 0) > Number(action.currentAskUsd ?? 0)) {
        if (!action.conversionPlan || typeof action.conversionPlan !== 'object') {
          findings.push(`${action.id}: higher-value manual outreach action must expose a conversion plan`);
        } else if (!/only after/i.test(action.conversionPlan.rule ?? '')) {
          findings.push(`${action.id}: conversion plan must preserve explicit-fit gating`);
        }
      }
      if (!action.tracking || typeof action.tracking !== 'object') {
        findings.push(`${action.id}: manual outreach action must include tracking URLs`);
      } else if (!/utm_source=manual_outreach/i.test(action.tracking.serviceUrl ?? '')) {
        findings.push(
          `${action.id}: manual outreach action service tracking URL is missing manual_outreach UTM`
        );
      }
    }
    if (action.type === 'manual-referral-handoff-send') {
      if (!/referral-partner-handoff-agent\.mjs record-sent/.test(action.command ?? '')) {
        findings.push(`${action.id}: referral handoff send action must record sent evidence`);
      }
      if (!/--sentAtUtc "<sent-at-utc>"/.test(action.command ?? '')) {
        findings.push(
          `${action.id}: referral handoff send action must require explicit sentAtUtc evidence`
        );
      }
      if (!/--messageHash [a-f0-9]{64}\b/.test(action.command ?? '')) {
        findings.push(
          `${action.id}: referral handoff send action must require approved terms SHA-256`
        );
      }
      if (action.artifact !== 'public/referral-partner-handoff-packet.md') {
        findings.push(
          `${action.id}: referral handoff send action must expose the prepared artifact`
        );
      }
      validateApprovedMessage({
        findings,
        label: action.id,
        message: action.approvedMessage,
        messageSha256: action.approvedMessageSha256,
        command: action.command
      });
    }
    if (action.type === 'inbound-reply-triage-monitor') {
      if (action.command !== 'npm run ops:inbound-reply-triage-plan') {
        findings.push(`${action.id}: inbound reply triage action must expose the triage plan`);
      }
      if (!Array.isArray(action.sources) || action.sources.length === 0) {
        findings.push(`${action.id}: inbound reply triage action must include live sources`);
      }
      for (const source of action.sources ?? []) {
        if (!/inbound-reply-triage-agent\.mjs markdown/.test(source.triageCommand ?? '')) {
          findings.push(`${action.id}: live source ${source.id ?? '<missing>'} must expose a triage command`);
        }
        if (!/--replyText "<reply-or-dm-text>"/.test(source.triageCommand ?? '')) {
          findings.push(`${action.id}: live source ${source.id ?? '<missing>'} must require reply text`);
        }
        if (!/--recordedAtUtc "<recorded-at-utc>"/.test(source.triageCommand ?? '')) {
          findings.push(
            `${action.id}: live source ${source.id ?? '<missing>'} must require recordedAtUtc`
          );
        }
      }
    }
  }
  for (const packet of brief.manualSendBatch ?? []) {
    if (!Number.isSafeInteger(packet.priority?.score) || packet.priority.score <= 0) {
      findings.push(
        `${packet.packetId ?? '<missing-packet>'}: manual send batch item must include a positive priority score`
      );
    }
    if (!packet.currentOfferId) {
      findings.push(
        `${packet.packetId ?? '<missing-packet>'}: manual send batch item must expose the current approved offer`
      );
    }
    validateApprovedMessage({
      findings,
      label: packet.packetId,
      message: packet.approvedMessage,
      messageSha256: packet.approvedMessageSha256,
      command: packet.command
    });
    if (
      !Number.isSafeInteger(Number(packet.currentAskUsd)) ||
      Number(packet.currentAskUsd) <= 0
    ) {
      findings.push(
        `${packet.packetId ?? '<missing-packet>'}: manual send batch item must expose the current approved ask`
      );
    }
    if (Number(packet.qualifiedRevenueUsd ?? 0) > Number(packet.currentAskUsd ?? 0)) {
      if (!packet.conversionPlan || typeof packet.conversionPlan !== 'object') {
        findings.push(
          `${packet.packetId ?? '<missing-packet>'}: higher-value manual send batch item must expose a conversion plan`
        );
      } else if (!/only after/i.test(packet.conversionPlan.rule ?? '')) {
        findings.push(
          `${packet.packetId ?? '<missing-packet>'}: conversion plan must preserve explicit-fit gating`
        );
      }
    }
    if (!packet.tracking || typeof packet.tracking !== 'object') {
      findings.push(
        `${packet.packetId ?? '<missing-packet>'}: manual send batch item must include tracking URLs`
      );
    } else if (!/utm_source=manual_outreach/i.test(packet.tracking.serviceUrl ?? '')) {
      findings.push(
        `${packet.packetId}: manual send batch service URL is missing manual_outreach UTM`
      );
    }
    if (!/--sentAtUtc "<sent-at-utc>"/.test(packet.command ?? '')) {
      findings.push(
        `${packet.packetId}: manual send batch command must require explicit sentAtUtc evidence`
      );
    }
    validateOperatorChecklist({
      findings,
      label: packet.packetId,
      checklist: packet.operatorChecklist,
      requireUtc: true
    });
    if (
      !/--messageHash (?:[0-9a-f]{64}|"<approved-message-sha256>")(?=\s|$)/.test(
        packet.command ?? ''
      )
    ) {
      findings.push(
        `${packet.packetId}: manual send batch command must require approved message SHA-256`
      );
    }
  }
  if (hasUnsafeOperatingLanguage(brief.boundary ?? '')) {
    findings.push('boundary contains prohibited operating language');
  }
  if (findings.length > 0) {
    throw new Error(`Revenue execution brief is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function withSentAtUtcPlaceholder(command) {
  const value = cleanLine(command);
  if (!/service-outreach-packet-agent\.mjs mark-sent/.test(value)) return value;
  let next = value;
  if (!/--sentAtUtc\b/.test(next)) {
    next = `${next} --sentAtUtc "<sent-at-utc>"`;
  }
  if (!/--messageHash\b/.test(next)) {
    next = `${next} --messageHash "<approved-message-sha256>"`;
  }
  return next;
}

function commercialContextFor({ packet, prospect, revenuePlan, revenueStreamsById }) {
  const currentOfferId = packet.offerId ?? prospect?.recommendedOfferId ?? null;
  const recommendedOfferId = prospect?.recommendedOfferId ?? currentOfferId;
  const currentAskUsd = revenueStreamsById?.get(currentOfferId)?.priceUsd ?? null;
  const recommendedAskUsd = revenueStreamsById?.get(recommendedOfferId)?.priceUsd ?? null;
  const shouldShowUpgradePath =
    recommendedOfferId &&
    currentOfferId &&
    recommendedOfferId !== currentOfferId &&
    Number(recommendedAskUsd ?? 0) > Number(currentAskUsd ?? 0);

  return {
    currentOfferId,
    currentAskUsd,
    recommendedOfferId,
    recommendedAskUsd,
    conversionPlan: shouldShowUpgradePath
      ? {
          upgradeOfferId: recommendedOfferId,
          upgradeAskUsd: recommendedAskUsd,
          rule:
            'Send the approved starter-audit packet first; discuss the higher-value setup offer only after the prospect explicitly wants help implementing public reporting.',
          qualificationQuestions: revenuePlan?.upgradePolicy?.qualificationQuestions ?? []
        }
      : null
  };
}

function matchingReferralHandoffPacket({ packet, campaignId }) {
  if (!packet || typeof packet !== 'object') return null;
  if (packet.mode !== 'referral-partner-handoff-packet') return null;
  if (packet.sourceCampaignId !== campaignId) return null;
  if (!/referral-partner-handoff-agent\.mjs record-sent/.test(packet.recordSentCommand ?? '')) {
    return null;
  }
  if (!/--sentAtUtc "<sent-at-utc>"/.test(packet.recordSentCommand ?? '')) return null;
  if (!/--messageHash [a-f0-9]{64}\b/.test(packet.recordSentCommand ?? '')) return null;
  return packet;
}

function invoiceRequestChecklist() {
  return [
    'Confirm the customer explicitly requested an invoice before rendering quote inputs.',
    'Capture the invoice-request evidence and UTC review time.',
    'Leave payment instructions for a separate chairman-approved exact-sats invoice.'
  ];
}

function inboundIntakeChecklist() {
  return [
    'Collect missing intake fields from the inbound lead before changing stage.',
    'Capture the reply evidence and UTC response time.',
    'Leave invoices, public commitments, compensation, and asset movement for separate approval.'
  ];
}

function paidPromotionVerificationChecklist() {
  return [
    'Confirm the live post still matches the approved copy before recording it.',
    'Capture the post URL, screenshot or export, and UTC verification time.',
    'Leave repeat spend decisions for a separate chairman-approved experiment.'
  ];
}

function referralHandoffSendChecklist() {
  return [
    'Open public/referral-partner-handoff-packet.md and send the Partner Reply exactly.',
    'Capture the send evidence and UTC send time before recording anything.',
    'Run the record-sent command with the approved terms hash only after the manual send exists.'
  ];
}

function referralHandoffPrepareChecklist() {
  return [
    'Render the referral handoff packet before sending partner terms.',
    'Capture the prepared artifact path and UTC review time.',
    'Leave partner approval, compensation, invoices, and asset movement for separate approval.'
  ];
}

function referralResponseChecklist() {
  return [
    'Record the partner response only from durable evidence.',
    'Capture acceptance or decline evidence and UTC response time.',
    'Leave customer leads, compensation, invoices, and asset movement for separate approval.'
  ];
}

function referredLeadChecklist() {
  return [
    'Confirm the referred customer has a project URL and contact path.',
    'Capture the referral evidence and UTC record time.',
    'Leave invoice review and payment instructions for separate approval.'
  ];
}

function liveReplyTriageChecklist() {
  return [
    'Collect the reply or DM text, source URL, profile URL, project URL, evidence, and UTC record time.',
    'Render the triage packet before deciding whether the lead needs intake or invoice review.',
    'Leave invoices, payment instructions, compensation, public posts, and asset movement for separate approval.'
  ];
}

function manualOutreachSendChecklist(packetId) {
  return [
    `Open public/service-outreach-packet-queue.json and locate ${packetId}.`,
    'Send only the packet message as written, then capture durable evidence and UTC send time.',
    'Run the mark-sent command only after the manual send evidence exists.'
  ];
}

function paidPromotionMeasurementChecklist() {
  return [
    'Wait for the campaign measurement window before recording conversion results.',
    'Capture profile analytics, inquiry counts, receipt evidence, and UTC measurement time.',
    'Leave any next spend decision for a separate chairman approval item.'
  ];
}

function maintenanceChecklist() {
  return [
    'Refresh the revenue-cycle plan before choosing the next action.',
    'Capture the current action queue evidence and UTC review time.',
    'Escalate only chairman-gated actions that preserve the reserve-growth boundary.'
  ];
}

function validateOperatorChecklist({ findings, label, checklist, requireUtc = false }) {
  if (!Array.isArray(checklist) || checklist.length < 3) {
    findings.push(`${label ?? '<missing-id>'}: operatorChecklist must include at least three steps`);
    return;
  }
  for (const [index, step] of checklist.entries()) {
    if (!cleanLine(step)) {
      findings.push(`${label ?? '<missing-id>'}: operatorChecklist step ${index + 1} is blank`);
    }
    if (hasUnsafeOperatingLanguage(step)) {
      findings.push(
        `${label ?? '<missing-id>'}: operatorChecklist step ${index + 1} contains prohibited operating language`
      );
    }
  }
  if (requireUtc && !checklist.some((step) => /\bUTC\b/.test(step))) {
    findings.push(`${label ?? '<missing-id>'}: operatorChecklist must require a UTC timestamp`);
  }
  if (!checklist.some((step) => /evidence/i.test(step))) {
    findings.push(`${label ?? '<missing-id>'}: operatorChecklist must require evidence capture`);
  }
}

function validateApprovedMessage({ findings, label, message, messageSha256, command }) {
  const approvedCopy = String(message ?? '').replace(/\r/g, '').trim();
  if (approvedCopy.length < 40) {
    findings.push(`${label ?? '<missing-id>'}: approvedMessage must include copy-ready text`);
    return;
  }
  if (!/^[a-f0-9]{64}$/.test(messageSha256 ?? '')) {
    findings.push(`${label ?? '<missing-id>'}: approvedMessageSha256 must be a SHA-256 hex digest`);
    return;
  }
  if (sha256(approvedCopy) !== messageSha256) {
    findings.push(`${label ?? '<missing-id>'}: approvedMessageSha256 must match approvedMessage`);
  }
  if (!String(command ?? '').includes(messageSha256)) {
    findings.push(`${label ?? '<missing-id>'}: command must include approvedMessageSha256`);
  }
  if (hasUnsafeOperatingLanguage(approvedCopy)) {
    findings.push(`${label ?? '<missing-id>'}: approvedMessage contains prohibited operating language`);
  }
}

function hasUnsafeOperatingLanguage(value) {
  const cleaned = String(value ?? '').replace(
    /\b(no|not|without|do not|must not|does not|block(?:s)?|before separate Executive Chairman approval)[^.;\n]*(?:private key|seed phrase|wash trading|guaranteed return|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)[^.;\n]*/gi,
    ''
  );
  return PROHIBITED_PATTERN.test(cleaned);
}

function sha256(value) {
  return createHash('sha256').update(normalizeMessage(value), 'utf8').digest('hex');
}

function normalizeMessage(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .trim();
}

export function renderRevenueExecutionMarkdown(brief) {
  validateRevenueExecutionBrief(brief);
  const lines = [
    `# ${brief.project} Revenue Execution Brief`,
    '',
    `Generated: ${brief.generatedAtUtc}`,
    `Reserve: ${brief.northStar.confirmedSats} sats confirmed, ${brief.northStar.remainingSats} sats remaining.`,
    '',
    '## Boundary',
    brief.boundary,
    '',
    '## Top Actions'
  ];

  for (const action of brief.topActions) {
    lines.push(
      '',
      `### ${action.priority}. ${action.objective}`,
      `Type: ${action.type}`,
      `Why: ${action.whyItCanCreateSats}`,
      ...(action.artifact ? [`Artifact: ${action.artifact}`] : []),
      ...(action.sources?.length
        ? [`Sources: ${action.sources.map((source) => `${source.id} (${source.url})`).join(', ')}`]
        : []),
      ...(action.outreachPriority
        ? [`Priority: ${action.outreachPriority.score} / ${action.outreachPriority.tier}`]
        : []),
      ...(action.currentOfferId && action.currentAskUsd
        ? [`Current approved ask: ${action.currentOfferId} / $${action.currentAskUsd}`]
        : []),
      ...(action.qualifiedRevenueUsd
        ? [`Qualified revenue path: $${action.qualifiedRevenueUsd}`]
        : []),
      ...(action.conversionPlan?.upgradeOfferId
        ? [`Upgrade path: ${action.conversionPlan.upgradeOfferId} only after explicit fit`]
        : []),
      `Evidence: ${action.evidenceRequired}`,
      ...(action.approvedMessageSha256
        ? [`Approved message SHA-256: ${action.approvedMessageSha256}`]
        : []),
      ...(action.approvedMessage
        ? ['', 'Approved send copy:', '', '```text', action.approvedMessage, '```']
        : []),
      ...(action.operatorChecklist?.length
        ? [
            '',
            'Operator checklist:',
            ...action.operatorChecklist.map((step) => `- ${step}`)
          ]
        : []),
      `Stop rule: ${action.stopRule}`,
      '',
      '```sh',
      action.command,
      '```'
    );
  }

  lines.push('', '## Manual Send Batch');
  if (brief.manualSendBatch.length === 0) {
    lines.push('No manual outreach sends are queued in this brief.');
  }
  for (const packet of brief.manualSendBatch) {
    lines.push(
      '',
      `- ${packet.prospectId}: ${packet.destination}`,
      ...(packet.priority ? [`  Priority: ${packet.priority.score} / ${packet.priority.tier}`] : []),
      ...(packet.currentOfferId && packet.currentAskUsd
        ? [`  Current approved ask: ${packet.currentOfferId} / $${packet.currentAskUsd}`]
        : []),
      ...(packet.qualifiedRevenueUsd
        ? [`  Qualified revenue path: $${packet.qualifiedRevenueUsd}`]
        : []),
      ...(packet.conversionPlan?.upgradeOfferId
        ? [`  Upgrade path: ${packet.conversionPlan.upgradeOfferId} only after explicit fit`]
        : []),
      ...(packet.tracking?.serviceUrl ? [`  Service: ${packet.tracking.serviceUrl}`] : []),
      ...(packet.tracking?.sampleAuditUrl ? [`  Sample: ${packet.tracking.sampleAuditUrl}`] : []),
      ...(packet.tracking?.intakeUrl ? [`  Intake: ${packet.tracking.intakeUrl}`] : []),
      ...(packet.approvedMessageSha256
        ? [`  Approved message SHA-256: ${packet.approvedMessageSha256}`]
        : []),
      ...(packet.approvedMessage
        ? ['  Approved send copy:', '```text', packet.approvedMessage, '```']
        : []),
      ...(packet.operatorChecklist?.length
        ? ['  Operator checklist:', ...packet.operatorChecklist.map((step) => `  - ${step}`)]
        : []),
      '```sh',
      packet.command,
      '```'
    );
  }

  lines.push('', '## Stop Rules');
  for (const rule of brief.stopRules) lines.push(`- ${rule}`);
  lines.push('', '## Next Action', brief.nextAction);

  return `${lines.join('\n')}\n`;
}

function assertBriefInputs({ status, paidPromotionLedger, outreachPacketQueue, maxManualSends }) {
  if (!status || typeof status !== 'object') throw new Error('Missing revenue cycle status.');
  if (!paidPromotionLedger || typeof paidPromotionLedger !== 'object') {
    throw new Error('Missing paid promotion ledger.');
  }
  if (!outreachPacketQueue || typeof outreachPacketQueue !== 'object') {
    throw new Error('Missing outreach packet queue.');
  }
  if (!Number.isSafeInteger(maxManualSends) || maxManualSends < 1 || maxManualSends > 20) {
    throw new Error('maxManualSends must be an integer from 1 to 20.');
  }

  const campaigns = paidPromotionLedger.campaigns ?? [];
  const awaitingVerification = campaigns.filter((campaign) =>
    ['paid-awaiting-post', 'post-reported-unverified'].includes(campaign.status)
  );
  const readyPackets = (outreachPacketQueue.packets ?? []).filter(
    (packet) => packet.status === 'ready-for-manual-send'
  );

  if (status.funnel?.paidPromotionCampaigns !== campaigns.length) {
    throw new Error('revenue cycle paid promotion campaign count must match the ledger.');
  }
  if (status.funnel?.paidPromotionsAwaitingVerification !== awaitingVerification.length) {
    throw new Error('revenue cycle paid promotion verification count must match the ledger.');
  }
  const awaitingConversion = campaigns.filter((campaign) => campaign.status === 'live-verified');
  if (status.funnel?.paidPromotionsAwaitingConversion !== awaitingConversion.length) {
    throw new Error('revenue cycle paid promotion conversion count must match the ledger.');
  }
  if (status.funnel?.readyOutreachPackets !== readyPackets.length) {
    throw new Error('revenue cycle ready outreach packet count must match the packet queue.');
  }
}

function usdToSatsEstimate({ usd, btcUsd }) {
  if (!Number.isFinite(usd) || !Number.isFinite(btcUsd) || btcUsd <= 0) return 0n;
  return BigInt(Math.floor((usd / btcUsd) * 100_000_000));
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function kebab(value) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
