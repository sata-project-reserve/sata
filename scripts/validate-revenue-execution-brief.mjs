import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildRevenueExecutionBrief,
  renderRevenueExecutionMarkdown,
  validateRevenueExecutionBrief
} from './lib/revenue-execution-brief.mjs';

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
    if (!triageAction.sources?.some((source) => source.id === 'diana-crypto-20260903-transparency-tweet')) {
      findings.push('triage monitor action must include the Diana paid-promotion source');
    }
    if (!triageAction.sources?.some((source) => source.id === 'pinned-proof-overview')) {
      findings.push('triage monitor action must include the published pinned social source');
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

const maintenanceBrief = buildRevenueExecutionBrief({
  status: {
    ...status,
    nextAction: 'Continue qualifying evidence-backed prospects.',
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
  } else if (publicMarkdown !== renderRevenueExecutionMarkdown(publicBrief)) {
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
