const PUBLIC_BASE_URL = 'https://sata-project-reserve.github.io/sata';
const PROHIBITED_PATTERN =
  /\b(private key|seed phrase|wash trading|guaranteed return|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)\b/i;

export function buildRevenueAttributionPlan({
  status,
  paidPromotionLedger,
  outreachPacketQueue,
  maxManualSends = 5,
  generatedAtUtc = new Date().toISOString()
}) {
  assertInputs({ status, paidPromotionLedger, outreachPacketQueue, maxManualSends });

  const paidCampaigns = (paidPromotionLedger.campaigns ?? []).map((campaign) => {
    const source = `x_${cleanSlug(campaign.promoter?.handle ?? campaign.id)}`;
    return {
      campaignId: campaign.id,
      promoter: campaign.promoter?.handle,
      currentStatus: campaign.status,
      currentPostTracking:
        campaign.reportedPostUrl && campaign.status !== 'proposed'
          ? 'current reported post is untracked unless X analytics or replies are recorded'
          : 'tracking links ready for next approved post',
      recommendedLinks: {
        transparency: trackedUrl('/transparency', {
          utm_source: source,
          utm_medium: 'paid_promotion',
          utm_campaign: campaign.id,
          utm_content: 'transparency_report'
        }),
        service: trackedUrl('/services/transparency-audit', {
          utm_source: source,
          utm_medium: 'paid_promotion',
          utm_campaign: campaign.id,
          utm_content: 'audit_service'
        })
      },
      recordConversionCommand: `node scripts/paid-promotion-agent.mjs record-conversion --campaign ${campaign.id} --evidence "<24h-x-analytics-or-reply-export>" --profileViewLift "<profile-view-change>" --trackedClicks 0 --serviceInquiries 0 --invoiceRequests 0 --confirmedReceiptsSats 0`,
      measurementRule:
        'Count only platform analytics, trackable link clicks, direct replies, invoice requests, and confirmed reserve receipts.'
    };
  });

  const outreachLinks = (outreachPacketQueue.packets ?? [])
    .filter((packet) => packet.status === 'ready-for-manual-send')
    .slice(0, maxManualSends)
    .map((packet) => ({
      packetId: packet.id,
      prospectId: packet.prospectId,
      trackedServiceUrl: trackedUrl('/services/transparency-audit', {
        utm_source: 'manual_outreach',
        utm_medium: cleanSlug(packet.channel ?? 'dm_email'),
        utm_campaign: packet.id,
        utm_content: packet.prospectId
      }),
      trackedTransparencyUrl: trackedUrl('/transparency', {
        utm_source: 'manual_outreach',
        utm_medium: cleanSlug(packet.channel ?? 'dm_email'),
        utm_campaign: packet.id,
        utm_content: packet.prospectId
      }),
      recordContactCommand: packet.recordContactCommand,
      measurementRule:
        'Record the send evidence first; later count only customer replies, invoice requests, and confirmed reserve receipts.'
    }));

  return {
    project: status.project,
    mode: 'revenue-attribution-plan',
    generatedAtUtc,
    reserveGoal: {
      confirmedSats: status.currentReserve.confirmedSats,
      targetSats: status.currentReserve.targetSats,
      remainingSats: status.currentReserve.remainingSats
    },
    policy: {
      requiredForNewPaidPromotion:
        'Use a campaign-specific tracked transparency or service URL in every new approved paid post.',
      currentPostRule:
        'Do not infer conversion from profile views alone; record platform analytics, replies, invoice requests, and receipts.',
      receiptRule:
        'Reserve progress is updated only from confirmed direct-reserve sats or approved allocation records.'
    },
    paidCampaigns,
    outreachLinks,
    nextAction:
      paidCampaigns[0]?.campaignId
        ? `Use attribution plan when measuring ${paidCampaigns[0].campaignId}; current reported post may need manual analytics.`
        : outreachLinks[0]?.packetId
          ? `Use tracked URLs when sending ${outreachLinks[0].packetId}.`
          : status.nextAction,
    boundary:
      'This plan creates measurement links only. It does not publish posts, contact prospects, approve spend, send invoices, grant tokens, or move assets.'
  };
}

export function validateRevenueAttributionPlan(plan) {
  const findings = [];
  if (plan.mode !== 'revenue-attribution-plan') {
    findings.push('plan mode must be revenue-attribution-plan');
  }
  if (!/^\d+$/.test(plan.reserveGoal?.remainingSats ?? '')) {
    findings.push('reserveGoal.remainingSats must be an integer string');
  }
  if (!/does not publish posts/i.test(plan.boundary ?? '')) {
    findings.push('boundary must say it does not publish posts');
  }
  if (!/move assets/i.test(plan.boundary ?? '')) {
    findings.push('boundary must say it does not move assets');
  }
  for (const campaign of plan.paidCampaigns ?? []) {
    for (const [label, url] of Object.entries(campaign.recommendedLinks ?? {})) {
      assertTrackedUrl({ findings, label: `${campaign.campaignId}.${label}`, url });
    }
    if (!/record-conversion/.test(campaign.recordConversionCommand ?? '')) {
      findings.push(`${campaign.campaignId}: recordConversionCommand is required`);
    }
  }
  for (const packet of plan.outreachLinks ?? []) {
    assertTrackedUrl({
      findings,
      label: `${packet.packetId}.service`,
      url: packet.trackedServiceUrl
    });
    assertTrackedUrl({
      findings,
      label: `${packet.packetId}.transparency`,
      url: packet.trackedTransparencyUrl
    });
    if (!/mark-sent --packet/.test(packet.recordContactCommand ?? '')) {
      findings.push(`${packet.packetId}: recordContactCommand must mark sent`);
    }
  }
  if (PROHIBITED_PATTERN.test(JSON.stringify(plan))) {
    findings.push('plan contains prohibited operating language');
  }
  if (findings.length > 0) {
    throw new Error(`Revenue attribution plan is invalid:\n- ${findings.join('\n- ')}`);
  }
  return true;
}

export function renderRevenueAttributionMarkdown(plan) {
  validateRevenueAttributionPlan(plan);
  const lines = [
    `# ${plan.project} Revenue Attribution Plan`,
    '',
    `Generated: ${plan.generatedAtUtc}`,
    `Reserve: ${plan.reserveGoal.confirmedSats} sats confirmed, ${plan.reserveGoal.remainingSats} sats remaining.`,
    '',
    '## Boundary',
    plan.boundary,
    '',
    '## Policy',
    `- ${plan.policy.requiredForNewPaidPromotion}`,
    `- ${plan.policy.currentPostRule}`,
    `- ${plan.policy.receiptRule}`,
    '',
    '## Paid Campaign Links'
  ];

  if (plan.paidCampaigns.length === 0) {
    lines.push('No paid campaigns are recorded.');
  }
  for (const campaign of plan.paidCampaigns) {
    lines.push(
      '',
      `### ${campaign.campaignId}`,
      `Promoter: ${campaign.promoter}`,
      `Current tracking: ${campaign.currentPostTracking}`,
      `Transparency: ${campaign.recommendedLinks.transparency}`,
      `Service: ${campaign.recommendedLinks.service}`,
      '',
      '```sh',
      campaign.recordConversionCommand,
      '```'
    );
  }

  lines.push('', '## Outreach Links');
  if (plan.outreachLinks.length === 0) {
    lines.push('No outreach links are queued.');
  }
  for (const packet of plan.outreachLinks) {
    lines.push(
      '',
      `### ${packet.prospectId}`,
      `Packet: ${packet.packetId}`,
      `Service: ${packet.trackedServiceUrl}`,
      `Transparency: ${packet.trackedTransparencyUrl}`,
      '',
      '```sh',
      packet.recordContactCommand,
      '```'
    );
  }

  lines.push('', '## Next Action', plan.nextAction);
  return `${lines.join('\n')}\n`;
}

function assertInputs({ status, paidPromotionLedger, outreachPacketQueue, maxManualSends }) {
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
}

function assertTrackedUrl({ findings, label, url }) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    findings.push(`${label}: invalid URL`);
    return;
  }
  if (parsed.origin + parsed.pathname === PUBLIC_BASE_URL) {
    findings.push(`${label}: URL must include a concrete path`);
  }
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    if (!parsed.searchParams.get(key)) findings.push(`${label}: missing ${key}`);
  }
}

function trackedUrl(pathname, params) {
  const url = new URL(`${PUBLIC_BASE_URL}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, cleanSlug(value));
  }
  return url.toString();
}

function cleanSlug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
}
