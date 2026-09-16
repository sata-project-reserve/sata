import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildRevenueExecutionBrief,
  renderRevenueExecutionMarkdown,
  validateRevenueExecutionBrief
} from './lib/revenue-execution-brief.mjs';
import { planningUsdToReserveSatsFloor } from './lib/planning-sats.mjs';

const status = await readJson(join('public', 'revenue-cycle-status.json'));
const paidPromotionLedger = await readJson(join('public', 'paid-promotion-ledger.json'));
const outreachPacketQueue = await readJson(join('public', 'service-outreach-packet-queue.json'));
const socialQueue = await readJson(join('public', 'social-agent-content-queue.json'));
const prospectPipeline = await readJson(join('public', 'sats-prospect-pipeline.json'));
const revenuePlan = await readJson(join('public', 'revenue-operating-plan.json'));
const referralPartnerPolicy = await readJson(join('public', 'referral-partner-policy.json'));
const referralPartnerHandoffQueue = await readJson(
  join('public', 'referral-partner-handoff-queue.json')
);
const referralPartnerHandoffPacket = await readOptionalJson(
  join('public', 'referral-partner-handoff-packet.json')
);
const brief = buildRevenueExecutionBrief({
  status,
  paidPromotionLedger,
  outreachPacketQueue,
  socialQueue,
  prospectPipeline,
  revenuePlan,
  referralPartnerPolicy,
  referralPartnerHandoffQueue,
  referralPartnerHandoffPacket,
  maxManualSends: 5,
  generatedAtUtc: '2026-09-03T20:00:00.000Z'
});
const markdown = renderRevenueExecutionMarkdown(brief);
const findings = [];
const publicBrief = await readOptionalJson(join('public', 'revenue-execution-brief.json'));
const publicMarkdown = await readOptionalText(join('public', 'revenue-execution-brief.md'));

try {
  validateRevenueExecutionBrief(brief);
} catch (error) {
  findings.push(error.message);
}

const primaryOfferId = revenuePlan.nextCycle?.primaryOfferId;
const primaryOffer = revenuePlan.revenueStreams?.find((stream) => stream.id === primaryOfferId);
const expectedReserveSats = planningUsdToReserveSatsFloor({
  usd: primaryOffer?.priceUsd ?? 0,
  btcUsd: revenuePlan.planningAssumptions?.btcUsd ?? 100000,
  reserveAllocationPercent:
    revenuePlan.allocationPolicy?.postReceiptAllocationPercent?.btcReserve ?? 70
}).toString();
const expectedSetupReserveSats = planningUsdToReserveSatsFloor({
  usd:
    revenuePlan.revenueStreams?.find((stream) => stream.id === 'transparency-report-setup')
      ?.priceUsd ?? 0,
  btcUsd: revenuePlan.planningAssumptions?.btcUsd ?? 100000,
  reserveAllocationPercent:
    revenuePlan.allocationPolicy?.postReceiptAllocationPercent?.btcReserve ?? 70
}).toString();

if (brief.unitEconomics?.primaryOfferId !== primaryOfferId) {
  findings.push('unit economics must use the revenue plan primary offer');
}
if (brief.unitEconomics?.starterAuditUsd !== primaryOffer?.priceUsd) {
  findings.push('unit economics starter audit price must match the active revenue plan');
}
if (brief.unitEconomics?.reserveSatsAtPlanningRate !== expectedReserveSats) {
  findings.push('unit economics reserve sats must match active price, BTC/USD, and allocation assumptions');
}
if (brief.unitEconomics?.starterAuditUsd === '50') {
  findings.push('unit economics must not use the deprecated $50 starter audit assumption');
}

if (status.funnel.paidPromotionsAwaitingVerification > 0) {
  if (brief.topActions[0]?.type !== 'paid-promotion-verification') {
    findings.push(
      'paid promotion verification must be the first top action while a campaign is unverified'
    );
  }
  if (
    !brief.topActions[0]?.command?.includes(
      'record-live --campaign diana-crypto-20260903-transparency-tweet'
    )
  ) {
    findings.push('first top action must expose the exact paid-promotion live evidence command');
  }
} else {
  if (brief.topActions.some((action) => action.type === 'paid-promotion-verification')) {
    findings.push('live-verified campaigns must not keep verification in the top actions');
  }
  if (
    !['post-receipt-referral-handoff', 'manual-referral-handoff-send'].includes(
      brief.topActions[0]?.type
    )
  ) {
    findings.push(
      'completed zero-receipt paid promotion must produce a post-receipt referral handoff action first'
    );
  }
  if (referralPartnerHandoffPacket) {
    if (brief.topActions[0]?.type !== 'manual-referral-handoff-send') {
      findings.push(
        'prepared referral handoff packet must produce a manual send evidence action first'
      );
    }
    if (!brief.topActions[0]?.command?.includes('referral-partner-handoff-agent.mjs record-sent')) {
      findings.push(
        'prepared referral handoff action must expose the record-sent evidence command'
      );
    }
    if (
      brief.topActions[0]?.evidenceIssueTemplateUrl !==
      'https://github.com/sata-project-reserve/sata/issues/new?template=referral-handoff-evidence.yml'
    ) {
      findings.push('prepared referral handoff action must expose the referral handoff evidence issue template');
    }
    if (
      brief.topActions[0]?.evidenceReviewCommand !==
      'npm run ops:referral-handoff-evidence-plan'
    ) {
      findings.push('prepared referral handoff action must expose the referral handoff evidence review command');
    }
  } else if (
    !brief.topActions[0]?.command?.includes('referral-partner-handoff-agent.mjs write-packet')
  ) {
    findings.push(
      'post-receipt referral handoff must expose the referral partner packet artifact command'
    );
  }
  if (brief.topActions[0]?.artifact !== 'public/referral-partner-handoff-packet.md') {
    findings.push('post-receipt referral handoff must expose the handoff packet artifact path');
  }
  if (!brief.topActions.some((action) => action.type === 'manual-outreach-send')) {
    findings.push('manual outreach must remain queued after referral handoff');
  }
  for (const action of brief.topActions.filter((item) => item.type === 'manual-outreach-send')) {
    if (
      !Number.isSafeInteger(action.outreachPriority?.score) ||
      action.outreachPriority.score <= 0
    ) {
      findings.push(`${action.id}: manual outreach action must include a positive priority score`);
    }
    if (!action.currentOfferId) {
      findings.push(`${action.id}: manual outreach action must expose the current approved offer`);
    }
    if (
      action.evidenceIssueTemplateUrl !==
      'https://github.com/sata-project-reserve/sata/issues/new?template=outreach-contact-evidence.yml'
    ) {
      findings.push(`${action.id}: manual outreach action must expose the contact evidence issue template`);
    }
    if (action.evidenceReviewCommand !== 'npm run ops:outreach-contact-evidence-plan') {
      findings.push(`${action.id}: manual outreach action must expose the contact evidence review command`);
    }
    if (
      !/outreach-contact-evidence-agent\.mjs render-template --packet/.test(
        action.evidenceIssueTemplateCommand ?? ''
      )
    ) {
      findings.push(`${action.id}: manual outreach action must expose the contact evidence issue-body command`);
    }
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
      if (action.reserveImpactPlanning?.qualifiedReserveSats !== expectedSetupReserveSats) {
        findings.push(
          `${action.id}: higher-value reserve planning sats must use decimal-safe revenue plan math`
        );
      }
    }
  }
  const triageAction = brief.topActions.find(
    (action) => action.type === 'inbound-reply-triage-monitor'
  );
  if (!triageAction) {
    findings.push('live attribution sources must produce an inbound reply triage monitor action');
  } else {
    if (triageAction.command !== 'npm run ops:inbound-reply-triage-plan') {
      findings.push('triage monitor action must expose the inbound reply triage plan');
    }
    if (
      triageAction.evidenceIssueTemplateUrl !==
      'https://github.com/sata-project-reserve/sata/issues/new?template=inbound-reply-evidence.yml'
    ) {
      findings.push('triage monitor action must expose the inbound reply evidence issue template');
    }
    if (triageAction.evidenceReviewCommand !== 'npm run ops:inbound-reply-evidence-plan') {
      findings.push('triage monitor action must expose the inbound reply evidence review command');
    }
    if (!triageAction.sources?.some((source) => source.id === 'diana-crypto-20260903-transparency-tweet')) {
      findings.push('triage monitor action must include the Diana paid-promotion source');
    }
    if (!triageAction.sources?.some((source) => source.id === 'pinned-proof-overview')) {
      findings.push('triage monitor action must include the published pinned social source');
    }
    for (const expected of [
      'sourceType',
      'sourceId',
      'contactHandle',
      'publicProfileUrl',
      'projectUrl',
      'replyText',
      'evidence',
      'recordedAtUtc'
    ]) {
      if (!triageAction.requiredEvidenceFields?.includes(expected)) {
        findings.push(`triage monitor action must require ${expected}`);
      }
    }
    const invoiceRule = triageAction.classificationRules?.find(
      (rule) => rule.classification === 'invoice-request-needs-chairman-review'
    );
    if (!invoiceRule?.customerAskedForInvoice) {
      findings.push('triage monitor invoice rule must set customerAskedForInvoice true');
    }
    if (invoiceRule?.suggestedReplyTemplateId !== 'invoice-request-boundary') {
      findings.push('triage monitor invoice rule must use invoice-request-boundary');
    }
    const intakeRule = triageAction.classificationRules?.find(
      (rule) => rule.classification === 'needs-intake-fields'
    );
    if (intakeRule?.customerAskedForInvoice !== false) {
      findings.push('triage monitor intake rule must keep customerAskedForInvoice false');
    }
    const rejectRule = triageAction.classificationRules?.find(
      (rule) => rule.classification === 'reject-prohibited-promotion'
    );
    if (rejectRule?.nextCommandAfterRecord !== null) {
      findings.push('triage monitor reject rule must not expose a follow-up command');
    }
  }
  const manualSocialPublishAction = brief.topActions.find(
    (action) => action.type === 'manual-social-publish'
  );
  if (!manualSocialPublishAction) {
    findings.push('approved social content must produce a manual social publish action');
  } else {
    if (!/social:agent -- record-published/.test(manualSocialPublishAction.command ?? '')) {
      findings.push('manual social publish action must expose the record-published command');
    }
    if (!/--publishedAtUtc "<published-at-utc>"/.test(manualSocialPublishAction.command ?? '')) {
      findings.push('manual social publish action must require explicit publishedAtUtc evidence');
    }
    if (!/--contentHash [a-f0-9]{64}\b/.test(manualSocialPublishAction.command ?? '')) {
      findings.push('manual social publish action must require the approved content hash');
    }
    if (
      manualSocialPublishAction.evidenceIssueTemplateUrl !==
      'https://github.com/sata-project-reserve/sata/issues/new?template=social-publish-evidence.yml'
    ) {
      findings.push('manual social publish action must expose the social publish evidence issue template');
    }
    if (
      manualSocialPublishAction.evidenceReviewCommand !==
      'npm run ops:social-publish-evidence-plan'
    ) {
      findings.push('manual social publish action must expose the social publish evidence review command');
    }
    if (!manualSocialPublishAction.approvedMessage || !manualSocialPublishAction.approvedMessageSha256) {
      findings.push('manual social publish action must include the exact approved post text and hash');
    }
    if (
      manualSocialPublishAction.approvedMessageSha256 &&
      !manualSocialPublishAction.command?.includes(manualSocialPublishAction.approvedMessageSha256)
    ) {
      findings.push('manual social publish command must include the approved post hash');
    }
  }
  if (status.funnel.paidPromotionsAwaitingConversion > 0) {
    if (!brief.constraints.some((constraint) => /24-hour conversion evidence/i.test(constraint))) {
      findings.push(
        'live-verified campaigns must preserve the 24-hour conversion evidence constraint'
      );
    }
    const measurement = brief.topActions.find(
      (action) => action.type === 'paid-promotion-conversion-measurement'
    );
    if (
      !measurement?.command?.includes(
        'record-conversion --campaign diana-crypto-20260903-transparency-tweet'
      )
    ) {
      findings.push('live-verified campaigns must expose a conversion measurement command');
    }
    if (!/--measuredAtUtc "<measured-at-utc>"/.test(measurement?.command ?? '')) {
      findings.push('conversion measurement command must require explicit measuredAtUtc evidence');
    }
  } else if (
    !brief.constraints.some(
      (constraint) =>
        /post-receipt referral handoff before repeat spend/i.test(constraint) ||
        /No paid promotion verification is currently pending/i.test(constraint)
    )
  ) {
    findings.push(
      'completed paid promotion state must clear or redirect pending paid-promotion work'
    );
  }
}
if (brief.manualSendBatch.length !== 5) {
  findings.push('manual send batch must default to the first five ready outreach packets');
}
for (const item of brief.manualSendBatch) {
  if (!item.currentOfferId) {
    findings.push(`${item.packetId}: manual send batch item must expose the current approved offer`);
  }
  if (!Number.isSafeInteger(Number(item.currentAskUsd)) || Number(item.currentAskUsd) <= 0) {
    findings.push(`${item.packetId}: manual send batch item must expose the current approved ask`);
  }
  if (Number(item.qualifiedRevenueUsd ?? 0) > Number(item.currentAskUsd ?? 0)) {
    if (!item.conversionPlan || typeof item.conversionPlan !== 'object') {
      findings.push(`${item.packetId}: higher-value manual send batch item must expose a conversion plan`);
    } else if (!/only after/i.test(item.conversionPlan.rule ?? '')) {
      findings.push(`${item.packetId}: conversion plan must preserve explicit-fit gating`);
    }
    if (item.reserveImpactPlanning?.qualifiedReserveSats !== expectedSetupReserveSats) {
      findings.push(
        `${item.packetId}: higher-value manual send reserve planning sats must use decimal-safe revenue plan math`
      );
    }
  }
  if (!item.tracking || typeof item.tracking !== 'object') {
    findings.push(`${item.packetId}: manual send batch item must include tracking URLs`);
  } else if (!/utm_source=manual_outreach/i.test(item.tracking.serviceUrl ?? '')) {
    findings.push(
      `${item.packetId}: manual send batch service tracking URL must include manual_outreach UTM`
    );
  }
  if (!/--messageHash [0-9a-f]{64}\b/.test(item.command ?? '')) {
    findings.push(
      `${item.packetId}: manual send batch command must require approved message SHA-256`
    );
  }
  if (!item.approvedMessage || !item.approvedMessageSha256) {
    findings.push(`${item.packetId}: manual send batch item must include copy-ready text and hash`);
  }
}
if (!brief.topActions.some((action) => action.type === 'manual-outreach-send')) {
  findings.push('brief must include manual outreach sends after paid-promotion verification');
}
for (const action of brief.topActions) {
  if (
    action.command?.includes('referral-partner-handoff-agent.mjs record-response') &&
    !action.command.includes('--respondedAtUtc "<responded-at-utc>"')
  ) {
    findings.push(
      `${action.id}: referral response command must require explicit respondedAtUtc evidence`
    );
  }
}
if (!markdown.includes('## Top Actions') || !markdown.includes('## Stop Rules')) {
  findings.push('markdown must include top actions and stop rules');
}
if (!markdown.includes('No autonomous transactions')) {
  findings.push('markdown must include the autonomous-transaction stop rule');
}
if (!markdown.includes('utm_source=manual_outreach')) {
  findings.push('markdown must include tracked manual outreach URLs');
}
if (!markdown.includes('Current approved ask:')) {
  findings.push('markdown must separate the current approved ask from the qualified revenue path');
}
if (!markdown.includes('Upgrade path:')) {
  findings.push('markdown must expose the explicit-fit upgrade path');
}
if (!markdown.includes('Approved message SHA-256:')) {
  findings.push('markdown must expose approved message hashes for copy-ready actions');
}
if (!markdown.includes('Approved send copy:')) {
  findings.push('markdown must include copy-ready approved send text');
}
if (!markdown.includes('Triage decision rules:')) {
  findings.push('markdown must include inbound reply triage decision rules');
}
if (!markdown.includes('Required evidence fields:')) {
  findings.push('markdown must include inbound reply required evidence fields');
}
if (!markdown.includes('Evidence intake: https://github.com/sata-project-reserve/sata/issues/new?template=inbound-reply-evidence.yml')) {
  findings.push('markdown must include inbound reply evidence intake URL');
}
if (!markdown.includes('Evidence review command: npm run ops:inbound-reply-evidence-plan')) {
  findings.push('markdown must include inbound reply evidence review command');
}
if (!markdown.includes('Evidence intake: https://github.com/sata-project-reserve/sata/issues/new?template=referral-handoff-evidence.yml')) {
  findings.push('markdown must include referral handoff evidence intake URL');
}
if (!markdown.includes('Evidence review command: npm run ops:referral-handoff-evidence-plan')) {
  findings.push('markdown must include referral handoff evidence review command');
}
if (!markdown.includes('Evidence intake: https://github.com/sata-project-reserve/sata/issues/new?template=outreach-contact-evidence.yml')) {
  findings.push('markdown must include outreach contact evidence intake URL');
}
if (!markdown.includes('Evidence review command: npm run ops:outreach-contact-evidence-plan')) {
  findings.push('markdown must include outreach contact evidence review command');
}
if (!markdown.includes('outreach-contact-evidence-agent.mjs render-template --packet')) {
  findings.push('markdown must include outreach contact evidence issue-body command');
}
if (!markdown.includes('SATA has a dedicated Bitcoin reserve address')) {
  findings.push('markdown must include the copy-ready approved social post text');
}
for (const command of markdown.match(
  /node scripts\/service-outreach-packet-agent\.mjs mark-sent[^\n]*/g
) ?? []) {
  if (!/--messageHash (?:[0-9a-f]{64}|"<approved-message-sha256>")(?=\s|$)/.test(command)) {
    findings.push(`markdown mark-sent command must require messageHash: ${command}`);
  }
}
if (hasUnsafeOperatingLanguage(markdown)) {
  findings.push('brief markdown contains prohibited operating language');
}

const inboundInvoiceBrief = buildRevenueExecutionBrief({
  status: {
    ...status,
    funnel: {
      ...status.funnel,
      inboundInvoiceRequestsNeedingChairmanReview: 1
    },
    actionQueue: [
      {
        id: 'inbound-invoice-request-hot-lead',
        type: 'inbound-invoice-request-packet',
        title: 'Render chairman review packet for inbound invoice request hot-lead.',
        command: 'node scripts/inbound-invoice-request-agent.mjs render --lead hot-lead',
        evidenceRequired: 'Inbound evidence and explicit invoice request.'
      },
      ...(status.actionQueue ?? [])
    ]
  },
  paidPromotionLedger,
  outreachPacketQueue,
  socialQueue,
  prospectPipeline,
  revenuePlan,
  referralPartnerPolicy,
  referralPartnerHandoffQueue,
  referralPartnerHandoffPacket,
  maxManualSends: 5,
  generatedAtUtc: '2026-09-03T20:00:00.000Z'
});
validateRevenueExecutionBrief(inboundInvoiceBrief);
if (inboundInvoiceBrief.topActions[0]?.type !== 'inbound-invoice-request-packet') {
  findings.push('inbound invoice requests must outrank manual outreach in the execution brief');
}
if (
  !/inbound-invoice-request-agent\.mjs render --lead hot-lead/.test(
    inboundInvoiceBrief.topActions[0]?.command ?? ''
  )
) {
  findings.push('inbound invoice request brief action must preserve the render command');
}

const inboundIntakeBrief = buildRevenueExecutionBrief({
  status: {
    ...status,
    funnel: {
      ...status.funnel,
      openInboundLeads: 1,
      inboundLeadsNeedingIntake: 1
    },
    actionQueue: [
      {
        id: 'inbound-intake-warm-lead',
        type: 'inbound-intake-reply',
        title: 'Send intake-fields reply for inbound lead warm-lead.',
        command: 'npm run ops:inbound-lead-plan',
        evidenceRequired: 'Inbound evidence plus exact compliant reply.'
      },
      ...(status.actionQueue ?? [])
    ]
  },
  paidPromotionLedger,
  outreachPacketQueue,
  socialQueue,
  prospectPipeline,
  revenuePlan,
  referralPartnerPolicy,
  referralPartnerHandoffQueue,
  referralPartnerHandoffPacket,
  maxManualSends: 5,
  generatedAtUtc: '2026-09-03T20:00:00.000Z'
});
validateRevenueExecutionBrief(inboundIntakeBrief);
if (inboundIntakeBrief.topActions[0]?.type !== 'inbound-intake-reply') {
  findings.push('inbound intake replies must outrank manual outreach in the execution brief');
}
if (!/ops:inbound-lead-plan/.test(inboundIntakeBrief.topActions[0]?.command ?? '')) {
  findings.push('inbound intake brief action must preserve the compliant reply command');
}

const receiptAllocationBrief = buildRevenueExecutionBrief({
  status: {
    ...status,
    funnel: {
      ...status.funnel,
      confirmedReceipts: 1,
      receiptsAwaitingAllocation: 1
    },
    actionQueue: [
      {
        id: 'allocate-receipt-1',
        type: 'receipt-allocation-proposal',
        title: 'Render receipt allocation proposal for receipt-1.',
        command: 'node scripts/sats-receipt-allocation-agent.mjs render receipt-1',
        evidenceRequired:
          'Confirmed direct-reserve BTC receipt and chairman allocation approval.'
      },
      ...(status.actionQueue ?? [])
    ]
  },
  paidPromotionLedger,
  outreachPacketQueue,
  socialQueue,
  prospectPipeline,
  revenuePlan,
  referralPartnerPolicy,
  referralPartnerHandoffQueue,
  referralPartnerHandoffPacket,
  maxManualSends: 5,
  generatedAtUtc: '2026-09-03T20:00:00.000Z'
});
validateRevenueExecutionBrief(receiptAllocationBrief);
if (receiptAllocationBrief.topActions[0]?.type !== 'receipt-allocation-proposal') {
  findings.push('receipt allocation proposals must outrank manual outreach in the execution brief');
}
if (
  !/sats-receipt-allocation-agent\.mjs record-allocation/.test(
    receiptAllocationBrief.topActions[0]?.recordAllocationCommand ?? ''
  )
) {
  findings.push('receipt allocation brief must expose the post-approval record-allocation command');
}
if (
  !/confirmChairmanAllocationApproval/.test(
    receiptAllocationBrief.topActions[0]?.recordAllocationCommand ?? ''
  )
) {
  findings.push('receipt allocation command must require explicit chairman approval text');
}
if (!/transparencyReportUrl/.test(receiptAllocationBrief.topActions[0]?.recordAllocationCommand ?? '')) {
  findings.push('receipt allocation command must require a published transparency report URL');
}
const receiptAllocationMarkdown = renderRevenueExecutionMarkdown(receiptAllocationBrief);
if (!receiptAllocationMarkdown.includes('record-allocation')) {
  findings.push('receipt allocation markdown must show the post-approval record-allocation command');
}

const maintenanceBrief = buildRevenueExecutionBrief({
  status: {
    ...status,
    nextAction: 'Continue qualifying evidence-backed prospects.',
    actionQueue: [],
    funnel: {
      ...status.funnel,
      readyOutreachPackets: 0,
      paidPromotionCampaigns: 0,
      paidPromotionsAwaitingVerification: 0,
      paidPromotionsAwaitingConversion: 0
    }
  },
  paidPromotionLedger: {
    ...paidPromotionLedger,
    campaigns: []
  },
  outreachPacketQueue: {
    ...outreachPacketQueue,
    packets: []
  },
  socialQueue: {
    ...socialQueue,
    posts: []
  },
  referralPartnerPolicy,
  referralPartnerHandoffQueue,
  referralPartnerHandoffPacket,
  generatedAtUtc: '2026-09-03T20:00:00.000Z'
});
if (maintenanceBrief.topActions[0]?.type !== 'revenue-cycle-maintenance') {
  findings.push('empty execution inputs must still produce a maintenance action');
}

if (publicBrief) {
  try {
    validateRevenueExecutionBrief(publicBrief);
  } catch (error) {
    findings.push(`public revenue execution brief is invalid: ${error.message}`);
  }
  if (publicBrief.unitEconomics?.starterAuditUsd !== primaryOffer?.priceUsd) {
    findings.push('public revenue-execution-brief.json must expose current primary-offer pricing');
  }
  if (publicBrief.unitEconomics?.reserveSatsAtPlanningRate !== expectedReserveSats) {
    findings.push('public revenue-execution-brief.json must expose current reserve-sats unit economics');
  }
  const expectedPublicBrief = buildRevenueExecutionBrief({
    status,
    paidPromotionLedger,
    outreachPacketQueue,
    socialQueue,
    prospectPipeline,
    revenuePlan,
    referralPartnerPolicy,
    referralPartnerHandoffQueue,
    referralPartnerHandoffPacket,
    maxManualSends: publicBrief.manualSendBatch?.length || 5,
    generatedAtUtc: publicBrief.generatedAtUtc
  });
  if (JSON.stringify(publicBrief) !== JSON.stringify(expectedPublicBrief)) {
    findings.push('public revenue-execution-brief.json must match the current generated brief');
  }
}
if (publicMarkdown) {
  if (!publicBrief) {
    findings.push(
      'public revenue-execution-brief.md requires matching revenue-execution-brief.json'
    );
  } else if (
    normalizeMarkdown(publicMarkdown) !== normalizeMarkdown(renderRevenueExecutionMarkdown(publicBrief))
  ) {
    findings.push('public revenue-execution-brief.md must match the public JSON brief');
  }
  for (const command of publicMarkdown.match(
    /node scripts\/service-outreach-packet-agent\.mjs mark-sent[^\n]*/g
  ) ?? []) {
    if (!/--messageHash (?:[0-9a-f]{64}|"<approved-message-sha256>")(?=\s|$)/.test(command)) {
      findings.push(`public markdown mark-sent command must require messageHash: ${command}`);
    }
  }
}

assertRejects('stale paid promotion count', /paid promotion campaign count must match/i, () =>
  buildRevenueExecutionBrief({
    status: {
      ...status,
      funnel: {
        ...status.funnel,
        paidPromotionCampaigns: 0
      }
    },
    paidPromotionLedger,
    outreachPacketQueue,
    referralPartnerPolicy,
    referralPartnerHandoffQueue,
    referralPartnerHandoffPacket,
    generatedAtUtc: '2026-09-03T20:00:00.000Z'
  })
);

if (findings.length > 0) {
  console.error('Revenue execution brief check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Revenue execution brief check passed: top actions are measurable, bounded, and sats-oriented.'
);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readOptionalText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function assertRejects(name, expected, fn) {
  try {
    fn();
  } catch (error) {
    if (!expected.test(error.message)) {
      throw new Error(`${name}: expected ${expected}, received ${error.message}`);
    }
    return;
  }
  throw new Error(`${name}: expected rejection.`);
}

function hasUnsafeOperatingLanguage(value) {
  const cleaned = String(value ?? '').replace(
    /\b(no|not|without|do not|must not|does not|block(?:s)?|before separate Executive Chairman approval)[^.;\n]*(?:private key|seed phrase|wash trading|guaranteed return|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)[^.;\n]*/gi,
    ''
  );
  return /\b(private key|seed phrase|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)\b/i.test(
    cleaned
  );
}

function normalizeMarkdown(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}
