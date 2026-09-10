import { createHash } from 'node:crypto';
import { buildLiveReplySources } from './live-reply-sources.mjs';
import { prioritizeOutreachPackets } from './prospect-priority.mjs';

export function buildRevenueCycleStatus({
  report,
  revenuePlan,
  ledger,
  invoiceQueue,
  prospectPipeline,
  outreachPacketQueue = { packets: [] },
  inboundLeadQueue = { leads: [] },
  paidPromotionLedger = { campaigns: [] },
  referralPartnerPolicy = null,
  referralPartnerHandoffQueue = { handoffs: [] },
  referralPartnerHandoffPacket = null,
  approvalQueue = { items: [] },
  socialQueue,
  env = process.env
}) {
  assertInputs({
    report,
    revenuePlan,
    ledger,
    invoiceQueue,
    prospectPipeline,
    outreachPacketQueue,
    inboundLeadQueue,
    paidPromotionLedger,
    referralPartnerPolicy,
    referralPartnerHandoffQueue,
    approvalQueue,
    socialQueue
  });

  const targetSats = BigInt(
    ledger.target?.targetSats ?? revenuePlan.nextCycle?.targetSats ?? '1000000000'
  );
  const currentReserveSats = BigInt(
    report.bitcoinReserve?.confirmedReserveSats ?? ledger.target?.currentReserveSats ?? '0'
  );
  const remainingSats = targetSats > currentReserveSats ? targetSats - currentReserveSats : 0n;
  const prospects = prospectPipeline.prospects ?? [];
  const invoices = invoiceQueue.invoices ?? [];
  const receipts = ledger.receipts ?? [];
  const allocations = ledger.allocations ?? [];
  const approvedInvoices = invoices.filter((invoice) => invoice.status === 'approved-by-chairman');
  const confirmedReceipts = receipts.filter((receipt) => receipt.status === 'confirmed');
  const allocationReceiptIds = new Set(allocations.map((allocation) => allocation.receiptId));
  const receiptsAwaitingAllocation = confirmedReceipts.filter(
    (receipt) => !allocationReceiptIds.has(receipt.id)
  );
  const readyOutreachPackets = (outreachPacketQueue.packets ?? []).filter(
    (packet) => packet.status === 'ready-for-manual-send'
  );
  const prioritizedReadyOutreachPackets = prioritizeOutreachPackets({
    packets: readyOutreachPackets,
    prospectPipeline,
    revenuePlan
  });
  const inboundInvoiceRequests = (inboundLeadQueue.leads ?? []).filter(
    (lead) => lead.status === 'invoice-requested-needs-chairman-review'
  );
  const openInboundLeads = (inboundLeadQueue.leads ?? []).filter(
    (lead) => lead.status !== 'closed-invalid'
  );
  const inboundLeadsNeedingIntake = openInboundLeads.filter(
    (lead) => lead.status === 'needs-intake'
  );
  const paidPromotionCampaigns = paidPromotionLedger.campaigns ?? [];
  const liveReplySources = buildLiveReplySources({ paidPromotionLedger, socialQueue });
  const paidPromotionsAwaitingVerification = paidPromotionCampaigns.filter((campaign) =>
    ['paid-awaiting-post', 'post-reported-unverified'].includes(campaign.status)
  );
  const paidPromotionsAwaitingConversion = paidPromotionCampaigns.filter(
    (campaign) => campaign.status === 'live-verified'
  );
  const recordedReferralHandoffCampaignIds = new Set(
    (referralPartnerHandoffQueue.handoffs ?? []).map((handoff) => handoff.sourceCampaignId)
  );
  const paidPromotionsReadyForReferralHandoff = paidPromotionCampaigns.filter(
    (campaign) =>
      campaign.status === 'completed' &&
      BigInt(campaign.conversion?.confirmedReceiptsSats ?? '0') === 0n &&
      referralPartnerPolicy?.status === 'approved-by-chairman' &&
      !recordedReferralHandoffCampaignIds.has(campaign.id)
  );
  const activeReferralHandoffs = (referralPartnerHandoffQueue.handoffs ?? []).filter(
    (handoff) => !['converted-to-lead', 'declined', 'closed-no-response'].includes(handoff.status)
  );
  const followUpAfterHours = Number(prospectPipeline.dailyCadence?.followUpAfterHours ?? 48);
  const generatedAt = new Date(env.SATA_REVENUE_CYCLE_GENERATED_AT_UTC ?? new Date().toISOString());
  const followUpDueProspects = prospects.filter((prospect) =>
    isFollowUpDue({ prospect, generatedAt, dueAfterHours: followUpAfterHours })
  );
  const approvedPosts = (socialQueue.posts ?? []).filter((post) => post.status === 'approved');
  const readyPosts = (socialQueue.posts ?? []).filter((post) => post.status === 'ready-for-review');
  const livePostingEnabled =
    env.SATA_X_AGENT_ENABLE_POSTING === 'true' && Boolean(env.X_ACCESS_TOKEN);

  const blockers = [];
  if (prospects.length === 0) blockers.push('No evidence-backed prospects are recorded.');
  if (approvedInvoices.length === 0)
    blockers.push('No chairman-approved exact-sats invoice is ready to send.');
  if (confirmedReceipts.length === 0)
    blockers.push('No confirmed direct-reserve BTC receipt is recorded.');
  if (approvedPosts.length > 0 && !livePostingEnabled) {
    blockers.push(
      'Approved social content exists; publish manually and record the live URL, or enable approved-only X credentials.'
    );
  }

  const actionQueue = buildActionQueue({
    prospects,
    approvedInvoices,
    receiptsAwaitingAllocation,
    readyOutreachPackets,
    inboundLeadsNeedingIntake,
    inboundInvoiceRequests,
    paidPromotionsAwaitingVerification,
    paidPromotionsAwaitingConversion,
    paidPromotionsReadyForReferralHandoff,
    activeReferralHandoffs,
    referralPartnerHandoffPacket,
    followUpDueProspects,
    approvedPosts,
    livePostingEnabled,
    prospectPipeline,
    approvalQueue,
    prioritizedReadyOutreachPackets,
    liveReplySources
  });

  return {
    project: revenuePlan.project,
    cycleId: revenuePlan.nextCycle?.id,
    objective: revenuePlan.objective,
    currentReserve: {
      confirmedSats: currentReserveSats.toString(),
      confirmedBtc: formatSatsAsBtc(currentReserveSats),
      targetSats: targetSats.toString(),
      remainingSats: remainingSats.toString(),
      remainingBtc: formatSatsAsBtc(remainingSats),
      latestReportGeneratedAtUtc: report.generatedAtUtc
    },
    funnel: {
      prospects: prospects.length,
      identifiedProspects: prospects.filter((prospect) => prospect.stage === 'identified').length,
      chairmanReviewProspects: prospects.filter((prospect) => prospect.stage === 'chairman-review')
        .length,
      outreachApprovedProspects: prospects.filter(
        (prospect) => prospect.stage === 'outreach-approved'
      ).length,
      approvedInvoices: approvedInvoices.length,
      confirmedReceipts: confirmedReceipts.length,
      receiptsAwaitingAllocation: receiptsAwaitingAllocation.length,
      recordedAllocations: allocations.length,
      readyOutreachPackets: readyOutreachPackets.length,
      openInboundLeads: openInboundLeads.length,
      inboundLeadsNeedingIntake: inboundLeadsNeedingIntake.length,
      inboundInvoiceRequestsNeedingChairmanReview: inboundInvoiceRequests.length,
      paidPromotionCampaigns: paidPromotionCampaigns.length,
      paidPromotionsAwaitingVerification: paidPromotionsAwaitingVerification.length,
      paidPromotionsAwaitingConversion: paidPromotionsAwaitingConversion.length,
      referralHandoffsActive: activeReferralHandoffs.length,
      referralHandoffsAwaitingResponse: activeReferralHandoffs.filter(
        (handoff) => handoff.status === 'sent-awaiting-response'
      ).length,
      followUpDueProspects: followUpDueProspects.length
    },
    social: {
      queueMode: socialQueue.mode,
      approvedPosts: approvedPosts.length,
      readyForReviewPosts: readyPosts.length,
      livePostingEnabled
    },
    blockers,
    actionQueue,
    nextAction: actionQueue[0]?.title ?? prospectPipeline.nextOperatingAction,
    boundary:
      'Agents may prepare records, packets, and proposals. The Executive Chairman approves outreach, invoices, transactions, allocations, paid promotion, token grants, and any asset movement.'
  };
}

export function validateRevenueCycleStatus(status) {
  const findings = [];
  if (!status.project) findings.push('status.project is required');
  if (!/1,000,000,000 sats|reserve/i.test(status.objective ?? '')) {
    findings.push('status.objective must preserve the reserve-growth objective');
  }
  if (!/^\d+$/.test(status.currentReserve?.confirmedSats ?? '')) {
    findings.push('currentReserve.confirmedSats must be an integer string');
  }
  if (!/^\d+$/.test(status.currentReserve?.targetSats ?? '')) {
    findings.push('currentReserve.targetSats must be an integer string');
  }
  if (
    !status.nextAction ||
    /pump|guarantee|wash|fake engagement|private key|seed phrase/i.test(status.nextAction)
  ) {
    findings.push('nextAction must be present and avoid prohibited routes');
  }
  if (!Array.isArray(status.actionQueue) || status.actionQueue.length === 0) {
    findings.push('actionQueue must include at least one executable operating item');
  }
  for (const item of status.actionQueue ?? []) {
    if (!item.id || !item.type || !item.title) {
      findings.push('actionQueue items require id, type, and title');
    }
    if (!Number.isInteger(item.priority) || item.priority < 1) {
      findings.push(
        `${item.id ?? '<missing-id>'}: actionQueue priority must be a positive integer`
      );
    }
    if (/pump|guarantee|wash|fake engagement|private key|seed phrase/i.test(item.title ?? '')) {
      findings.push(`${item.id ?? '<missing-id>'}: actionQueue title contains prohibited wording`);
    }
    if (
      item.type === 'manual-outreach-send' &&
      !/--sentAtUtc "<sent-at-utc>"/.test(item.command ?? '')
    ) {
      findings.push(
        `${item.id ?? '<missing-id>'}: manual outreach command must require explicit sentAtUtc evidence`
      );
    }
    if (
      item.type === 'manual-outreach-send' &&
      !/--messageHash (?:[0-9a-f]{64}|"<approved-message-sha256>")(?=\s|$)/.test(item.command ?? '')
    ) {
      findings.push(
        `${item.id ?? '<missing-id>'}: manual outreach command must require approved message SHA-256`
      );
    }
    if (item.type === 'manual-outreach-send' && item.outreachPriority) {
      if (!Number.isSafeInteger(item.outreachPriority.score) || item.outreachPriority.score < 0) {
        findings.push(
          `${item.id ?? '<missing-id>'}: manual outreach action must expose a non-negative outreach priority score`
        );
      }
      if (!['hot', 'warm', 'standard'].includes(item.outreachPriority.tier)) {
        findings.push(
          `${item.id ?? '<missing-id>'}: manual outreach action must expose a known outreach priority tier`
        );
      }
      if (!Array.isArray(item.outreachPriority.reasons)) {
        findings.push(
          `${item.id ?? '<missing-id>'}: manual outreach action must expose outreach priority reasons`
        );
      }
      if (
        item.qualifiedRevenueUsd &&
        (!Number.isSafeInteger(Number(item.qualifiedRevenueUsd)) ||
          Number(item.qualifiedRevenueUsd) < 0)
      ) {
        findings.push(
          `${item.id ?? '<missing-id>'}: manual outreach action qualified revenue must be non-negative`
        );
      }
    }
    if (
      item.type === 'manual-social-publish' &&
      !/--contentHash [a-f0-9]{64}\b/.test(item.command ?? '')
    ) {
      findings.push(
        `${item.id ?? '<missing-id>'}: manual social publish command must require approved post content SHA-256`
      );
    }
    if (
      item.type === 'manual-social-publish' &&
      !/--publishedAtUtc "<published-at-utc>"/.test(item.command ?? '')
    ) {
      findings.push(
        `${item.id ?? '<missing-id>'}: manual social publish command must require explicit publishedAtUtc evidence`
      );
    }
    if (
      item.type === 'manual-referral-handoff-send' &&
      !/referral-partner-handoff-agent\.mjs record-sent/.test(item.command ?? '')
    ) {
      findings.push(
        `${item.id ?? '<missing-id>'}: referral handoff send action must record sent evidence`
      );
    }
    if (
      item.type === 'manual-referral-handoff-send' &&
      !/--sentAtUtc "<sent-at-utc>"/.test(item.command ?? '')
    ) {
      findings.push(
        `${item.id ?? '<missing-id>'}: referral handoff send action must require explicit sentAtUtc evidence`
      );
    }
    if (
      item.type === 'manual-referral-handoff-send' &&
      !/--messageHash [a-f0-9]{64}\b/.test(item.command ?? '')
    ) {
      findings.push(
        `${item.id ?? '<missing-id>'}: referral handoff send action must require approved terms SHA-256`
      );
    }
    if (item.type === 'inbound-reply-triage-monitor') {
      if (item.command !== 'npm run ops:inbound-reply-triage-plan') {
        findings.push(
          `${item.id ?? '<missing-id>'}: reply triage action must expose the inbound reply triage plan`
        );
      }
      if (!Array.isArray(item.sources) || item.sources.length === 0) {
        findings.push(
          `${item.id ?? '<missing-id>'}: reply triage action must include live attribution sources`
        );
      }
      for (const source of item.sources ?? []) {
        if (
          !source.id ||
          !source.url ||
          !/inbound-reply-triage-agent\.mjs markdown/.test(source.triageCommand ?? '')
        ) {
          findings.push(
            `${item.id ?? '<missing-id>'}: reply triage sources must include id, url, and triage command`
          );
        }
      }
    }
    if (!/Chairman|authorized human|agent|customer/i.test(item.requiredActor ?? '')) {
      findings.push(
        `${item.id ?? '<missing-id>'}: actionQueue requiredActor must name the responsible boundary`
      );
    }
  }
  const manualOutreachActions = (status.actionQueue ?? []).filter(
    (item) => item.type === 'manual-outreach-send' && item.outreachPriority
  );
  for (let index = 1; index < manualOutreachActions.length; index += 1) {
    if (
      manualOutreachActions[index - 1].outreachPriority.score <
      manualOutreachActions[index].outreachPriority.score
    ) {
      findings.push('manual outreach actions must remain sorted by descending outreach priority');
      break;
    }
  }
  if (!/Executive Chairman approves/i.test(status.boundary ?? '')) {
    findings.push('boundary must preserve chairman approval authority');
  }
  if (findings.length > 0) {
    throw new Error(`Revenue cycle status is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

function buildActionQueue({
  prospects,
  approvedInvoices,
  receiptsAwaitingAllocation,
  readyOutreachPackets,
  inboundLeadsNeedingIntake,
  inboundInvoiceRequests,
  paidPromotionsAwaitingVerification,
  paidPromotionsAwaitingConversion,
  paidPromotionsReadyForReferralHandoff,
  activeReferralHandoffs,
  referralPartnerHandoffPacket,
  followUpDueProspects,
  approvedPosts,
  livePostingEnabled,
  prospectPipeline,
  approvalQueue,
  prioritizedReadyOutreachPackets,
  liveReplySources
}) {
  const actions = [];
  const approvalItems = approvalQueue.items ?? [];
  const pendingChairmanApprovals = approvalItems.filter(
    (item) => item.status === 'ready-for-chairman-review'
  );
  const approvedOutreachApprovals = approvalItems.filter(
    (item) => item.status === 'approved-by-chairman' && item.id?.startsWith('outreach-approval-')
  );
  const pendingOutreachProspectIds = new Set(
    pendingChairmanApprovals
      .filter((item) => item.id?.startsWith('outreach-approval-'))
      .flatMap((item) => outreachProspectIdsFromTitle(item.title))
  );
  const hasPendingProspectReview = pendingChairmanApprovals.some((item) =>
    item.id?.startsWith('prospect-review-batch-')
  );

  for (const receipt of receiptsAwaitingAllocation) {
    actions.push({
      id: `allocate-${receipt.id}`,
      priority: actions.length + 1,
      type: 'receipt-allocation-proposal',
      title: `Render receipt allocation proposal for ${receipt.id}.`,
      requiredActor: 'agent prepares proposal; Executive Chairman approves allocation',
      command: `node scripts/sats-receipt-allocation-agent.mjs render --receipt ${receipt.id}`,
      evidenceRequired: 'Confirmed direct-reserve BTC receipt and chairman allocation approval.',
      boundary: 'No reserve accounting change is final until the Executive Chairman approves it.'
    });
  }

  for (const invoice of approvedInvoices) {
    actions.push({
      id: `payment-packet-${invoice.id}`,
      priority: actions.length + 1,
      type: 'approved-invoice-payment-packet',
      title: `Render approved customer payment packet for ${invoice.id} before the quote expires.`,
      requiredActor: 'agent prepares packet; authorized human sends it',
      command: `node scripts/sats-invoice-payment-packet-agent.mjs render --invoice ${invoice.id}`,
      evidenceRequired: 'Chairman-approved exact-sats invoice record.',
      boundary: 'Payment instructions must route only to the published reserve address.'
    });
  }

  for (const lead of inboundInvoiceRequests) {
    actions.push({
      id: `inbound-invoice-request-${lead.id}`,
      priority: actions.length + 1,
      type: 'inbound-invoice-request-packet',
      title: `Render chairman review packet for inbound invoice request ${lead.id}.`,
      requiredActor: 'agent prepares quote inputs; Executive Chairman approves invoice',
      command: `node scripts/inbound-invoice-request-agent.mjs render --lead ${lead.id}`,
      evidenceRequired: 'Inbound lead evidence and explicit customer invoice request.',
      boundary: 'No exact-sats invoice or payment instruction may be sent before chairman approval.'
    });
  }

  for (const lead of inboundLeadsNeedingIntake) {
    actions.push({
      id: `inbound-intake-${lead.id}`,
      priority: actions.length + 1,
      type: 'inbound-intake-reply',
      title: `Send intake-fields reply for inbound lead ${lead.id}.`,
      requiredActor: 'Executive Chairman or authorized human',
      command: 'npm run ops:inbound-lead-plan',
      evidenceRequired: 'Inbound reply or DM evidence plus the exact compliant intake reply sent.',
      boundary:
        'No invoice, payment instruction, paid work, token grant, public commitment, or asset movement is approved by intake follow-up.'
    });
  }

  for (const campaign of paidPromotionsAwaitingVerification) {
    actions.push({
      id: `verify-paid-promotion-${campaign.id}`,
      priority: actions.length + 1,
      type: 'paid-promotion-verification',
      title: `Verify paid promotion campaign ${campaign.id} before counting it live or approving repeat spend.`,
      requiredActor: 'Executive Chairman or authorized human',
      command: 'npm run ops:paid-promotion-plan',
      evidenceRequired:
        'Live post URL plus screenshot or exported text showing disclosure, unchanged copy, timestamp, and any edits or deletion.',
      boundary:
        'Verification does not approve more paid promotion, token grants, payment, asset movement, price claims, or market-support claims.'
    });
  }

  for (const campaign of paidPromotionsReadyForReferralHandoff) {
    const displayName = cleanLine(campaign.promoter?.displayName || campaign.promoter?.handle);
    const preparedPacket = matchingReferralHandoffPacket({
      packet: referralPartnerHandoffPacket,
      campaignId: campaign.id
    });
    if (preparedPacket) {
      actions.push({
        id: `send-referral-handoff-${campaign.id}`,
        priority: actions.length + 1,
        type: 'manual-referral-handoff-send',
        title: `Send prepared no-upfront post-receipt referral terms to ${displayName} and record sent evidence.`,
        requiredActor: 'Executive Chairman or authorized human',
        command: preparedPacket.recordSentCommand,
        artifact: 'public/referral-partner-handoff-packet.md',
        evidenceRequired:
          'Partner terms sent evidence, explicit sentAtUtc timestamp, and approved terms SHA-256.',
        boundary:
          'Recording sent evidence does not approve upfront spend, posts, compensation, invoices, grants, or asset movement.'
      });
      continue;
    }
    actions.push({
      id: `referral-handoff-${campaign.id}`,
      priority: actions.length + 1,
      type: 'post-receipt-referral-handoff',
      title: `Prepare and send ${displayName} a no-upfront post-receipt referral role after completed campaign ${campaign.id}.`,
      requiredActor: 'Executive Chairman or authorized human',
      command: `node scripts/referral-partner-handoff-agent.mjs write-packet --campaign ${campaign.id}`,
      artifact: 'public/referral-partner-handoff-packet.md',
      evidenceRequired:
        'Partner terms sent evidence after the approved handoff packet is manually sent.',
      boundary:
        'Referral handoff does not approve upfront spend, posts, compensation, invoices, grants, or asset movement.'
    });
  }

  for (const handoff of activeReferralHandoffs) {
    actions.push({
      id: `track-referral-handoff-${handoff.id}`,
      priority: actions.length + 1,
      type: 'track-referral-handoff-response',
      title:
        handoff.status === 'accepted-awaiting-referred-lead'
          ? `Record referred customer evidence for accepted partner handoff ${handoff.id}.`
          : `Record partner response for referral handoff ${handoff.id}.`,
      requiredActor: 'Executive Chairman or authorized human',
      command:
        handoff.status === 'accepted-awaiting-referred-lead'
          ? `node scripts/inbound-service-lead-agent.mjs record-lead --lead "<lead-id>" --sourceType manual-referral --sourceId referral-partner-${handoff.partner.id} --contactHandle "<customer-handle-or-contact>" --publicProfileUrl "<https-customer-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --evidence "<referral-and-customer-interest-evidence>" --customerAskedForInvoice false --recordedAtUtc "<recorded-at-utc>" --convertedAtUtc "<converted-at-utc>"`
          : `node scripts/referral-partner-handoff-agent.mjs record-response --handoff ${handoff.id} --accepted true --evidence "<partner-response-evidence>" --respondedAtUtc "<responded-at-utc>"`,
      evidenceRequired:
        handoff.status === 'accepted-awaiting-referred-lead'
          ? 'Referred customer identity, project URL, contact path, and customer interest evidence.'
          : 'Partner response evidence accepting or declining post-receipt referral terms.',
      boundary:
        'Tracking a referral handoff does not approve compensation, invoices, payment instructions, token grants, or asset movement.'
    });
  }

  if (liveReplySources.length > 0) {
    actions.push({
      id: 'triage-live-replies',
      priority: actions.length + 1,
      type: 'inbound-reply-triage-monitor',
      title: 'Triage replies and DMs from live SATA attribution sources before cold outreach.',
      requiredActor: 'Executive Chairman or authorized human',
      command: 'npm run ops:inbound-reply-triage-plan',
      sources: liveReplySources,
      evidenceRequired:
        'Reply or DM text, live source id, profile URL, project URL, durable evidence, and explicit recordedAtUtc timestamp.',
      boundary:
        'Triage only. Do not contact leads, send payment instructions, create invoices, grant tokens, or move assets.'
    });
  }

  for (const packet of prioritizedReadyOutreachPackets) {
    actions.push({
      id: `send-${packet.id}`,
      priority: actions.length + 1,
      type: 'manual-outreach-send',
      title: packet.prospectId
        ? `Send priority-scored manual outreach packet ${packet.id} for ${packet.prospectId} and record contact evidence.`
        : `Send ready manual outreach packet ${packet.id} and record contact evidence.`,
      requiredActor: 'Executive Chairman or authorized human',
      command: withSentAtUtcPlaceholder(packet.recordContactCommand, packet.id),
      outreachPriority: packet.priority,
      qualifiedRevenueUsd: packet.qualifiedRevenueUsd,
      evidenceRequired:
        'Contact URL, message permalink, email record, or other durable send evidence.',
      boundary:
        'Send the approved factual copy only; no price, return, buyer, liquidity, investment, or market-support claims.'
    });
  }

  for (const campaign of paidPromotionsAwaitingConversion) {
    actions.push({
      id: `measure-paid-promotion-${campaign.id}`,
      priority: actions.length + 1,
      type: 'paid-promotion-conversion-measurement',
      title: `Record 24-hour conversion measurement for paid promotion campaign ${campaign.id}.`,
      requiredActor: 'Executive Chairman or authorized human',
      command: `node scripts/paid-promotion-agent.mjs record-conversion --campaign ${campaign.id} --evidence "<24h-analytics-and-inquiry-log>" --profileViewLift "<profile-view-change-or-not-recorded>" --trackedClicks 0 --serviceInquiries 0 --invoiceRequests 0 --confirmedReceiptsSats 0 --measuredAtUtc "<measured-at-utc>"`,
      evidenceRequired:
        '24-hour analytics, inquiry log, invoice request count, and confirmed receipt record if any.',
      boundary:
        'Measurement does not approve repeat spend, compensation, token grants, payment instructions, price claims, or market-support claims.'
    });
  }

  for (const prospect of followUpDueProspects) {
    actions.push({
      id: `follow-up-${prospect.id}`,
      priority: actions.length + 1,
      type: 'manual-follow-up-send',
      title: `Render and manually send due follow-up for contacted prospect ${prospect.id}.`,
      requiredActor: 'authorized human',
      command: `node scripts/sats-prospect-follow-up-agent.mjs render --prospect ${prospect.id}`,
      evidenceRequired:
        'Follow-up message permalink, email record, or other durable send evidence.',
      boundary:
        'Follow-up copy must not request payment, send payment instructions, or add price, return, buyer, liquidity, investment, or market-support claims.'
    });
  }

  for (const item of pendingChairmanApprovals) {
    actions.push({
      id: `approve-${item.id}`,
      priority: actions.length + 1,
      type: 'chairman-approval-needed',
      title: `Chairman decision needed for ${item.id}: ${item.title}.`,
      requiredActor: 'Executive Chairman',
      command: approvalCommand(item),
      evidenceRequired: `${item.evidence?.length ?? 0} evidence record(s) in executive approval queue.`,
      boundary:
        'Approval records a chairman decision only; it does not contact prospects, approve invoices, move assets, or make public commitments.'
    });
  }

  for (const item of approvedOutreachApprovals) {
    const prospectIds = outreachProspectIdsFromTitle(item.title).filter((prospectId) => {
      const prospect = prospects.find((candidate) => candidate.id === prospectId);
      return prospect?.stage === 'chairman-review';
    });
    if (prospectIds.length === 0) continue;
    actions.push({
      id: `advance-${item.id}`,
      priority: actions.length + 1,
      type: 'advance-approved-outreach',
      title: `Advance chairman-approved outreach prospects for ${item.id}.`,
      requiredActor: 'agent',
      command: `node scripts/sats-outreach-approval-agent.mjs advance --approvalId ${item.id} --prospects ${prospectIds.join(',')} --transitionedAtUtc "<transitioned-at-utc>"`,
      evidenceRequired: 'Approved outreach approval item and matching chairman-review prospects.',
      boundary: 'Advancing prospect state does not send outreach.'
    });
  }

  const invoiceRequested = prospects.find((prospect) => prospect.stage === 'invoice-requested');
  if (invoiceRequested) {
    actions.push({
      id: `quote-${invoiceRequested.id}`,
      priority: actions.length + 1,
      type: 'invoice-quote-inputs',
      title: `Prepare exact-sats invoice quote inputs for invoice-requested prospect ${invoiceRequested.id}.`,
      requiredActor: 'agent prepares quote inputs; Executive Chairman approves invoice',
      command: `node scripts/sats-invoice-request-agent.mjs render --prospects ${invoiceRequested.id}`,
      evidenceRequired: 'Customer request for invoice and public reserve address match.',
      boundary: 'No invoice or payment instruction may be sent before chairman approval.'
    });
  }

  const contacted = prospects.find((prospect) => prospect.stage === 'contacted');
  if (contacted) {
    actions.push({
      id: `wait-invoice-request-${contacted.id}`,
      priority: actions.length + 1,
      type: 'await-customer-invoice-request',
      title: `Wait for ${contacted.id} to request an invoice before quote preparation.`,
      requiredActor: 'customer',
      command: 'npm run ops:prospect-response-plan',
      evidenceRequired: 'Customer reply requesting an invoice.',
      boundary: 'Do not push payment instructions without a customer invoice request.'
    });
  }

  const outreachApproved = prospects.find((prospect) => prospect.stage === 'outreach-approved');
  const queuedProspectIds = new Set(readyOutreachPackets.map((packet) => packet.prospectId));
  if (outreachApproved && !queuedProspectIds.has(outreachApproved.id)) {
    actions.push({
      id: `render-outreach-${outreachApproved.id}`,
      priority: actions.length + 1,
      type: 'render-approved-outreach-packet',
      title: `Render manual outreach packet for approved prospect ${outreachApproved.id}.`,
      requiredActor: 'agent',
      command: `node scripts/service-outreach-packet-agent.mjs write-approved --prospect ${outreachApproved.id}`,
      evidenceRequired: 'Outreach-approved prospect record.',
      boundary: 'Rendering a packet does not send the outreach.'
    });
  }

  const nextChairmanReviewProspects = prospects
    .filter(
      (prospect) =>
        prospect.stage === 'chairman-review' && !pendingOutreachProspectIds.has(prospect.id)
    )
    .slice(0, Number(prospectPipeline.dailyCadence?.outreachLimit ?? 3));
  if (nextChairmanReviewProspects.length > 0) {
    const prospectIds = nextChairmanReviewProspects.map((prospect) => prospect.id).join(',');
    actions.push({
      id: `draft-outreach-approval-${nextChairmanReviewProspects.map((prospect) => prospect.id).join('-')}`,
      priority: actions.length + 1,
      type: 'draft-outreach-approval',
      title: `Draft contact-only outreach approval packet for chairman-reviewed prospects ${nextChairmanReviewProspects.map((prospect) => prospect.id).join(', ')}.`,
      requiredActor: 'agent prepares approval item; Executive Chairman approves outreach',
      command: `node scripts/sats-outreach-approval-agent.mjs write-draft --prospects ${prospectIds}`,
      evidenceRequired: 'Chairman-reviewed prospect record.',
      boundary:
        'Draft approval does not authorize contact until the Executive Chairman approves it.'
    });
  }

  const identified = prospects.find((prospect) => prospect.stage === 'identified');
  if (identified && !hasPendingProspectReview) {
    actions.push({
      id: 'render-next-prospect-review',
      priority: actions.length + 1,
      type: 'prospect-review-packet',
      title:
        'Render prospect review packet for the next identified candidates before any outreach.',
      requiredActor: 'agent prepares review packet; Executive Chairman approves prospect review',
      command: 'npm run ops:prospect-review-plan',
      evidenceRequired: 'Evidence-backed prospect candidates.',
      boundary: 'Prospects cannot move beyond identified without chairman review.'
    });
  }

  if (prospects.length === 0) {
    actions.push({
      id: 'identify-evidence-backed-prospects',
      priority: actions.length + 1,
      type: 'prospect-discovery',
      title: prospectPipeline.nextOperatingAction,
      requiredActor: 'agent',
      command: 'npm run ops:prospect-candidate-plan',
      evidenceRequired: 'Public source evidence for each prospect.',
      boundary: 'Only factual, evidence-backed prospects may enter the pipeline.'
    });
  }

  if (approvedPosts.length > 0 && !livePostingEnabled) {
    actions.push({
      id: `publish-social-${approvedPosts[0].id}`,
      priority: actions.length + 1,
      type: 'manual-social-publish',
      title: `Manually publish approved post ${approvedPosts[0].id} and record the live URL for attribution.`,
      requiredActor: 'Executive Chairman or authorized human',
      command: `npm run social:agent -- record-published --post ${approvedPosts[0].id} --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash ${socialPostContentHash(approvedPosts[0])}`,
      evidenceRequired: 'Published @SATAReserve post URL plus screenshot or exported text.',
      boundary: 'Only chairman-approved factual posts may be published.'
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'continue-prospect-qualification',
      priority: 1,
      type: 'prospect-qualification',
      title: 'Continue qualifying evidence-backed prospects and prepare chairman-review records.',
      requiredActor: 'agent',
      command: 'npm run ops:prospect-plan',
      evidenceRequired: 'Public source evidence for each prospect.',
      boundary:
        'No outreach, invoice, paid work, or asset movement without the required approval gate.'
    });
  }

  return actions.map((action, index) => ({ ...action, priority: index + 1 }));
}

function approvalCommand(item) {
  return `npm run ops:approve -- ${item.id} --confirm-chairman-approval "I am Executive Chairman and approve ${item.id}"`;
}

function outreachProspectIdsFromTitle(title) {
  const match = /^Approve factual outreach to (?<ids>.+)$/.exec(title ?? '');
  return (match?.groups?.ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function isFollowUpDue({ prospect, generatedAt, dueAfterHours }) {
  if (prospect.stage !== 'contacted') return false;
  if (!prospect.contact?.contactedAtUtc) return false;
  if (!Number.isSafeInteger(dueAfterHours) || dueAfterHours < 24) return false;
  const lastFollowUpAt = [...(prospect.followUps ?? [])]
    .map((followUp) => followUp.followedUpAtUtc)
    .filter(Boolean)
    .sort()
    .at(-1);
  const basis = new Date(lastFollowUpAt ?? prospect.contact.contactedAtUtc);
  if (Number.isNaN(basis.getTime()) || Number.isNaN(generatedAt.getTime())) return false;
  const dueAt = new Date(basis.getTime() + dueAfterHours * 60 * 60 * 1000);
  return generatedAt >= dueAt;
}

function assertInputs({
  report,
  revenuePlan,
  ledger,
  invoiceQueue,
  prospectPipeline,
  outreachPacketQueue,
  paidPromotionLedger,
  approvalQueue,
  inboundLeadQueue,
  referralPartnerPolicy,
  socialQueue
}) {
  const required = {
    report,
    revenuePlan,
    ledger,
    invoiceQueue,
    prospectPipeline,
    outreachPacketQueue,
    paidPromotionLedger,
    approvalQueue,
    inboundLeadQueue,
    socialQueue
  };
  for (const [label, value] of Object.entries(required)) {
    if (!value || typeof value !== 'object') throw new Error(`Missing ${label}.`);
  }
  if (invoiceQueue.paymentPolicy?.reserveAddress !== report.bitcoinReserve?.address) {
    throw new Error('Invoice reserve address must match the latest transparency report.');
  }
  if (prospectPipeline.target?.reserveTargetSats !== ledger.target?.targetSats) {
    throw new Error('Prospect pipeline target must match the sats-generation ledger target.');
  }
}

function formatSatsAsBtc(sats) {
  const whole = sats / 100_000_000n;
  const fraction = (sats % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function socialPostContentHash(post) {
  return (
    post?.contentSha256 ??
    createHash('sha256').update(normalizeContent(post?.text), 'utf8').digest('hex')
  );
}

function normalizeContent(value) {
  return String(value ?? '').replaceAll('\r\n', '\n');
}

function withSentAtUtcPlaceholder(command, packetId) {
  const value = cleanLine(
    command ??
      `node scripts/service-outreach-packet-agent.mjs mark-sent --packet ${packetId} --evidence "<contact-evidence-url-or-reference>" --messageHash "<approved-message-sha256>"`
  );
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

function kebab(value) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
