import { buildPaidPromotionPlan } from './paid-promotion-ledger.mjs';

const PROHIBITED_PATTERN =
  /\b(private key|seed phrase|wash trading|guaranteed return|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)\b/i;

export function buildRevenueExecutionBrief({
  status,
  paidPromotionLedger,
  outreachPacketQueue,
  maxManualSends = 5,
  generatedAtUtc = new Date().toISOString()
}) {
  assertBriefInputs({ status, paidPromotionLedger, outreachPacketQueue, maxManualSends });

  const paidPromotionPlan = buildPaidPromotionPlan({
    ledger: paidPromotionLedger,
    generatedAtUtc
  });
  const readyPackets = (outreachPacketQueue.packets ?? []).filter(
    (packet) => packet.status === 'ready-for-manual-send'
  );
  const topPackets = readyPackets.slice(0, maxManualSends);
  const awaitingVerification = paidPromotionPlan.awaitingVerification ?? [];
  const actions = [];

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
      stopRule:
        'Do not approve repeat paid promotion until verification and 24-hour conversion results are recorded.'
    });
  }

  for (const packet of topPackets) {
    actions.push({
      id: `send-${packet.id}`,
      type: 'manual-outreach-send',
      priority: actions.length + 1,
      objective: `Send approved transparency-audit outreach to ${packet.prospectId}.`,
      whyItCanCreateSats:
        'The shortest route to new reserve sats is a paid transparency-audit customer requesting an invoice.',
      command: packet.recordContactCommand,
      evidenceRequired:
        'Durable proof of manual send, such as a message permalink, email record, or contact screenshot reference.',
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
          : 'No paid promotion verification is currently pending.',
      'Manual outreach packets must be sent by a human and then marked with durable evidence.'
    ],
    unitEconomics: {
      starterAuditUsd: '50',
      illustrativeSatsAtBtcUsd100k: estimatedIfOneStarterClosesSats.toString(),
      note:
        'This is planning math only; record actual sats only after a confirmed direct-reserve receipt.'
    },
    topActions,
    manualSendBatch: topPackets.map((packet) => ({
      packetId: packet.id,
      prospectId: packet.prospectId,
      destination: packet.destination?.publicProfileUrl,
      command: packet.recordContactCommand
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
      if (!cleanLine(action[field])) findings.push(`${action.id ?? '<missing-id>'}: missing ${field}`);
    }
    if (PROHIBITED_PATTERN.test(JSON.stringify(action))) {
      findings.push(`${action.id}: action contains prohibited operating language`);
    }
    if (!cleanLine(action.evidenceRequired)) {
      findings.push(`${action.id}: evidenceRequired is required`);
    }
    if (!cleanLine(action.stopRule)) {
      findings.push(`${action.id}: stopRule is required`);
    }
  }
  if (PROHIBITED_PATTERN.test(brief.boundary ?? '')) {
    findings.push('boundary contains prohibited operating language');
  }
  if (findings.length > 0) {
    throw new Error(`Revenue execution brief is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
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
      `Evidence: ${action.evidenceRequired}`,
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
