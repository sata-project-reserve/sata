import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prioritizeOutreachPackets } from './lib/prospect-priority.mjs';

const CONTACT_EVIDENCE_INTAKE_URL =
  'https://github.com/sata-project-reserve/sata/issues/new?template=outreach-contact-evidence.yml';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan'] = process.argv;
  const [status, prospectPipeline, outreachPacketQueue, inboundLeadQueue, revenuePlan] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'sats-prospect-pipeline.json')),
    readJson(join('public', 'service-outreach-packet-queue.json')),
    readJson(join('public', 'inbound-service-lead-queue.json')),
    readJson(join('public', 'revenue-operating-plan.json'))
  ]);
  const brief = buildReplyConversionBrief({
    status,
    prospectPipeline,
    outreachPacketQueue,
    inboundLeadQueue,
    revenuePlan
  });

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(brief, null, 2));
      break;
    case 'markdown':
      console.log(renderReplyConversionMarkdown(brief));
      break;
    case 'write':
      await writeReplyConversionBrief(brief);
      break;
    default:
      throw new Error(
        `Unknown reply conversion brief command: ${command}. Use plan, json, markdown, or write.`
      );
  }
}

export function buildReplyConversionBrief({
  status,
  prospectPipeline,
  outreachPacketQueue,
  inboundLeadQueue,
  revenuePlan = null,
  generatedAtUtc = new Date().toISOString(),
  maxItems = 5
}) {
  if (!status) throw new Error('Missing revenue cycle status.');
  if (!prospectPipeline) throw new Error('Missing prospect pipeline.');
  if (!outreachPacketQueue) throw new Error('Missing outreach packet queue.');
  if (!inboundLeadQueue) throw new Error('Missing inbound lead queue.');
  if (!Number.isSafeInteger(maxItems) || maxItems < 1 || maxItems > 20) {
    throw new Error('maxItems must be an integer from 1 to 20.');
  }

  const prospects = prospectPipeline.prospects ?? [];
  const packets = outreachPacketQueue.packets ?? [];
  const leads = inboundLeadQueue.leads ?? [];
  const prospectsById = new Map(prospects.map((prospect) => [prospect.id, prospect]));
  const readyPackets = prioritizeOutreachPackets({
    packets: packets.filter((packet) => packet.status === 'ready-for-manual-send'),
    prospectPipeline,
    revenuePlan
  });
  const sentPackets = packets.filter((packet) => packet.status === 'sent');
  const revenueStreamsById = new Map(
    (revenuePlan?.revenueStreams ?? []).map((stream) => [stream.id, stream])
  );
  const outreachApproved = readyPackets
    .map((packet) =>
      contactRecordFor({
        prospect: prospectsById.get(packet.prospectId),
        packet,
        revenuePlan,
        revenueStreamsById
      })
    )
    .filter(Boolean)
    .slice(0, maxItems);
  const contacted = prospects
    .filter((prospect) => prospect.stage === 'contacted')
    .map(invoiceRequestRecordFor)
    .slice(0, maxItems);
  const invoiceRequested = prospects
    .filter((prospect) => prospect.stage === 'invoice-requested')
    .map(invoicePacketRecordFor)
    .slice(0, maxItems);
  const inboundInvoiceRequests = leads
    .filter((lead) => lead.status === 'invoice-requested-needs-chairman-review')
    .map((lead) => ({
      leadId: lead.id,
      contactHandle: lead.contactHandle,
      requestedOfferId: lead.requestedOfferId,
      evidence: lead.evidence,
      renderCommand: `node scripts/inbound-invoice-request-agent.mjs render --lead ${lead.id}`,
      boundary:
        'Render a chairman review packet only. Do not send payment instructions before approval.'
    }))
    .slice(0, maxItems);
  const invoiceConversionSprint = buildInvoiceConversionSprint({
    inboundInvoiceRequests,
    invoiceRequested,
    contacted,
    outreachApproved,
    revenuePlan
  });

  const conversionStages = [
    {
      id: 'triage-inbound-reply',
      eligibleStage: 'live reply or DM evidence',
      outputStage: 'needs-intake or invoice-requested-needs-chairman-review',
      evidenceRequired: 'Reply or DM text, source, public profile, project URL, and durable evidence.',
      commandTemplate:
        'node scripts/inbound-reply-triage-agent.mjs markdown --sourceType <source-type> --sourceId <source-id> --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"'
    },
    {
      id: 'record-sent-contact',
      eligibleStage: 'outreach-approved',
      outputStage: 'contacted',
      evidenceRequired: 'Manual send evidence or durable contact record.',
      commandTemplate:
        'node scripts/service-outreach-packet-agent.mjs mark-sent --packet <packetId> --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash "<approved-message-sha256>"'
    },
    {
      id: 'record-invoice-request',
      eligibleStage: 'contacted',
      outputStage: 'invoice-requested',
      evidenceRequired: 'Customer reply explicitly asking for an invoice.',
      commandTemplate:
        'node scripts/sats-prospect-response-agent.mjs record-invoice-request --prospect <id> --offer <recommendedOfferId> --evidence "<invoice-request-evidence-url-or-reference>" --confirmedCustomerRequestedInvoice true --requestedAtUtc "<requested-at-utc>"'
    },
    {
      id: 'render-outbound-invoice-request-packet',
      eligibleStage: 'invoice-requested',
      outputStage: 'chairman-review-packet',
      evidenceRequired: 'Recorded invoice-request stage plus prior contact evidence.',
      commandTemplate: 'node scripts/sats-invoice-request-agent.mjs render --prospects "<id>"'
    },
    {
      id: 'render-inbound-invoice-request-packet',
      eligibleStage: 'invoice-requested-needs-chairman-review',
      outputStage: 'chairman-review-packet',
      evidenceRequired: 'Inbound lead evidence showing explicit invoice request.',
      commandTemplate: 'node scripts/inbound-invoice-request-agent.mjs render --lead <id>'
    }
  ];

  return {
    project: status.project,
    mode: 'chairman-gated-reply-conversion-brief',
    generatedAtUtc,
    reserve: status.currentReserve,
    counts: {
      outreachApprovedProspects: String(status.funnel?.outreachApprovedProspects ?? 0),
      readyOutreachPackets: String(readyPackets.length),
      sentOutreachPackets: String(sentPackets.length),
      contactedProspects: String(prospects.filter((prospect) => prospect.stage === 'contacted').length),
      invoiceRequestedProspects: String(
        prospects.filter((prospect) => prospect.stage === 'invoice-requested').length
      ),
      inboundInvoiceRequests: String(inboundInvoiceRequests.length)
    },
    conversionStages,
    eligibleContactRecording: outreachApproved,
    eligibleInvoiceRequestRecording: contacted,
    eligibleOutboundInvoicePackets: invoiceRequested,
    inboundInvoiceRequests,
    invoiceConversionSprint,
    nextAction: nextReplyAction({
      inboundInvoiceRequests,
      invoiceRequested,
      contacted,
      sentPackets,
      readyPackets,
      status
    }),
    stopRules: [
      'No payment instructions without a chairman-approved exact-sats invoice.',
      'No invoice request record unless the customer explicitly asks for an invoice.',
      'No autonomous transactions, token grants, public posts, paid promotion, or asset movement.',
      'No reserve progress counted until a direct-reserve receipt is confirmed.',
      'No price, return, liquidity, buyer, or market-support claims.'
    ],
    boundary:
      'This brief records reply-conversion evidence only. It does not contact prospects, approve invoices, send payment instructions, move assets, grant tokens, publish posts, or make commitments.'
  };
}

export function renderReplyConversionMarkdown(brief) {
  const lines = [
    `# ${brief.project} Reply Conversion Brief`,
    '',
    `Generated: ${brief.generatedAtUtc}`,
    `Reserve: ${brief.reserve.confirmedSats} sats confirmed, ${brief.reserve.remainingSats} sats remaining.`,
    '',
    '## Boundary',
    brief.boundary,
    '',
    '## Current Counts',
    `Outreach-approved prospects: ${brief.counts.outreachApprovedProspects}`,
    `Ready outreach packets: ${brief.counts.readyOutreachPackets}`,
    `Sent outreach packets: ${brief.counts.sentOutreachPackets}`,
    `Contacted prospects: ${brief.counts.contactedProspects}`,
    `Invoice-requested prospects: ${brief.counts.invoiceRequestedProspects}`,
    `Inbound invoice requests: ${brief.counts.inboundInvoiceRequests}`,
    '',
    '## Next Action',
    brief.nextAction,
    '',
    '## Invoice Conversion Sprint',
    `Status: ${brief.invoiceConversionSprint.status}`,
    `Objective: ${brief.invoiceConversionSprint.objective}`,
    `Next evidence gate: ${brief.invoiceConversionSprint.nextEvidenceGate}`,
    `Planning BTC/USD: ${brief.invoiceConversionSprint.planningBtcUsd}`,
    `Current ask reserve impact: ${brief.invoiceConversionSprint.reserveImpactIfCurrentAskClosesSats} sats`,
    `Qualified path reserve impact: ${brief.invoiceConversionSprint.reserveImpactIfQualifiedUpgradeClosesSats} sats`,
    `Stop rule: ${brief.invoiceConversionSprint.stopRule}`,
    '',
    '### Candidate',
    brief.invoiceConversionSprint.candidate
      ? [
          `ID: ${brief.invoiceConversionSprint.candidate.id}`,
          `Type: ${brief.invoiceConversionSprint.candidate.type}`,
          `Offer: ${brief.invoiceConversionSprint.candidate.currentOfferId}`,
          `Current ask: $${brief.invoiceConversionSprint.candidate.currentAskUsd}`,
          `Qualified ask: $${brief.invoiceConversionSprint.candidate.qualifiedAskUsd}`,
          `Evidence: ${brief.invoiceConversionSprint.candidate.evidenceRequired}`,
          ...(brief.invoiceConversionSprint.candidate.contactEvidenceFormUrl
            ? [`Evidence form: ${brief.invoiceConversionSprint.candidate.contactEvidenceFormUrl}`]
            : []),
          ...(brief.invoiceConversionSprint.candidate.approvedMessageSha256
            ? [
                `Approved message SHA-256: ${brief.invoiceConversionSprint.candidate.approvedMessageSha256}`
              ]
            : [])
        ].join('\n')
      : 'No candidate is available.',
    ...(brief.invoiceConversionSprint.candidate?.approvedMessage
      ? [
          '',
          '### Approved Sprint Copy',
          '',
          '```text',
          brief.invoiceConversionSprint.candidate.approvedMessage,
          '```'
        ]
      : []),
    '',
    '### Sprint Commands',
    ...brief.invoiceConversionSprint.commands.flatMap((command) => [
      '',
      `#### ${command.label}`,
      command.reason,
      '',
      '```sh',
      command.command,
      '```'
    ]),
    '',
    '## Conversion Stages'
  ];

  for (const stage of brief.conversionStages) {
    lines.push(
      '',
      `### ${stage.id}`,
      `Eligible stage: ${stage.eligibleStage}`,
      `Output stage: ${stage.outputStage}`,
      `Evidence required: ${stage.evidenceRequired}`,
      '',
      '```sh',
      stage.commandTemplate,
      '```'
    );
  }

  lines.push('', '## Eligible Contact Recording');
  if (brief.eligibleContactRecording.length === 0) {
    lines.push('No outreach-approved prospects are ready for contact recording.');
  }
  for (const item of brief.eligibleContactRecording) {
    lines.push(
      '',
      `### ${item.prospectId}`,
      `Offer: ${item.recommendedOfferId}`,
      `Current approved ask: ${item.currentOfferId} / $${item.currentAskUsd}`,
      ...(item.qualifiedRevenueUsd ? [`Qualified revenue path: $${item.qualifiedRevenueUsd}`] : []),
      ...(item.conversionPlan?.upgradeOfferId
        ? [`Upgrade path: ${item.conversionPlan.upgradeOfferId} only after explicit fit`]
        : []),
      ...(item.priority ? [`Priority: ${item.priority.score} / ${item.priority.tier}`] : []),
      `Packet: ${item.packetId}`,
      `Project: ${item.projectUrl}`,
      ...(item.tracking?.serviceUrl ? [`Service: ${item.tracking.serviceUrl}`] : []),
      ...(item.tracking?.sampleAuditUrl ? [`Sample: ${item.tracking.sampleAuditUrl}`] : []),
      ...(item.tracking?.intakeUrl ? [`Intake: ${item.tracking.intakeUrl}`] : []),
      '',
      '```sh',
      item.recordSentContactCommand,
      '```'
    );
  }

  lines.push('', '## Eligible Invoice Requests');
  if (brief.eligibleInvoiceRequestRecording.length === 0) {
    lines.push('No contacted prospects are ready for invoice-request recording.');
  }
  for (const item of brief.eligibleInvoiceRequestRecording) {
    lines.push(
      '',
      `### ${item.prospectId}`,
      `Offer: ${item.recommendedOfferId}`,
      `Contact evidence: ${item.contactEvidence}`,
      '',
      '```sh',
      item.recordInvoiceRequestCommand,
      '```'
    );
  }

  lines.push('', '## Outbound Invoice Packets');
  if (brief.eligibleOutboundInvoicePackets.length === 0) {
    lines.push('No outbound invoice-request packets are ready for chairman review.');
  }
  for (const item of brief.eligibleOutboundInvoicePackets) {
    lines.push(
      '',
      `### ${item.prospectId}`,
      `Offer: ${item.requestedOfferId}`,
      `Request evidence: ${item.requestEvidence}`,
      '',
      '```sh',
      item.renderCommand,
      '```'
    );
  }

  lines.push('', '## Inbound Invoice Requests');
  if (brief.inboundInvoiceRequests.length === 0) {
    lines.push('No inbound invoice requests are waiting for chairman review.');
  }
  for (const item of brief.inboundInvoiceRequests) {
    lines.push(
      '',
      `### ${item.leadId}`,
      `Handle: ${item.contactHandle}`,
      `Offer: ${item.requestedOfferId}`,
      `Evidence: ${item.evidence}`,
      '',
      '```sh',
      item.renderCommand,
      '```'
    );
  }

  lines.push('', '## Stop Rules');
  for (const rule of brief.stopRules) lines.push(`- ${rule}`);
  return `${lines.join('\n')}\n`;
}

function contactRecordFor({ prospect, packet, revenuePlan, revenueStreamsById }) {
  if (!prospect || !packet) return null;
  const currentOfferId = packet.offerId ?? prospect.recommendedOfferId;
  const recommendedOfferId = prospect.recommendedOfferId;
  const currentAskUsd = revenueStreamsById?.get(currentOfferId)?.priceUsd ?? null;
  const recommendedAskUsd = revenueStreamsById?.get(recommendedOfferId)?.priceUsd ?? null;
  const shouldShowUpgradePath =
    recommendedOfferId &&
    currentOfferId &&
    recommendedOfferId !== currentOfferId &&
    Number(recommendedAskUsd ?? 0) > Number(currentAskUsd ?? 0);
  return {
    prospectId: prospect.id,
    recommendedOfferId,
    currentOfferId,
    currentAskUsd,
    recommendedAskUsd,
    projectUrl: prospect.projectUrl,
    publicProfileUrl: prospect.publicProfileUrl,
    packetId: packet.id,
    tracking: packet.tracking ?? null,
    approvedMessage: packet.message,
    approvedMessageSha256: packet.messageSha256,
    priority: packet.priority,
    qualifiedRevenueUsd: packet.qualifiedRevenueUsd,
    conversionPlan: shouldShowUpgradePath
      ? {
          upgradeOfferId: recommendedOfferId,
          upgradeAskUsd: recommendedAskUsd,
          rule:
            'Send the approved starter-audit packet first; discuss the higher-value setup offer only after the prospect explicitly wants help implementing public reporting.',
          qualificationQuestions: revenuePlan?.upgradePolicy?.qualificationQuestions ?? []
        }
      : null,
    recordSentContactCommand: withRequiredContactEvidencePlaceholders(packet.recordContactCommand, packet.id),
    boundary:
      'Record only after chairman-approved outreach has been sent and durable contact evidence exists. Prefer the mark-sent command so packet and prospect state move together.'
  };
}

function withRequiredContactEvidencePlaceholders(command, packetId) {
  const value = String(
    command ??
      `node scripts/service-outreach-packet-agent.mjs mark-sent --packet ${packetId ?? '<packetId>'} --evidence "<contact-evidence-url-or-reference>" --messageHash "<approved-message-sha256>"`
  )
    .replace(/\s+/g, ' ')
    .trim();
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

function invoiceRequestRecordFor(prospect) {
  return {
    prospectId: prospect.id,
    recommendedOfferId: prospect.recommendedOfferId,
    projectUrl: prospect.projectUrl,
    contactEvidence: prospect.contact?.evidence ?? '',
    recordInvoiceRequestCommand: `node scripts/sats-prospect-response-agent.mjs record-invoice-request --prospect ${prospect.id} --offer ${prospect.recommendedOfferId} --evidence "<invoice-request-evidence-url-or-reference>" --confirmedCustomerRequestedInvoice true --requestedAtUtc "<requested-at-utc>"`,
    boundary:
      'Record only when the contacted customer explicitly asks for an invoice. Do not send payment instructions.'
  };
}

function invoicePacketRecordFor(prospect) {
  return {
    prospectId: prospect.id,
    requestedOfferId: prospect.invoiceRequest?.requestedOfferId ?? prospect.recommendedOfferId,
    projectUrl: prospect.projectUrl,
    contactEvidence: prospect.contact?.evidence ?? '',
    requestEvidence: prospect.invoiceRequest?.evidence ?? '',
    renderCommand: `node scripts/sats-invoice-request-agent.mjs render --prospects "${prospect.id}"`,
    boundary:
      'Prepare chairman review inputs only. Exact-sats invoice and payment instructions still require approval.'
  };
}

function buildInvoiceConversionSprint({
  inboundInvoiceRequests,
  invoiceRequested,
  contacted,
  outreachApproved,
  revenuePlan
}) {
  const planningBtcUsd = '100000';
  const objective =
    'Create one chairman-reviewable exact-sats invoice path from the highest-probability revenue evidence without exposing payment instructions early.';
  const current =
    inboundInvoiceRequests[0] ?? invoiceRequested[0] ?? contacted[0] ?? outreachApproved[0] ?? null;
  const candidate = current ? sprintCandidateFor({ item: current, revenuePlan }) : null;
  const currentAskUsd = Number(candidate?.currentAskUsd ?? 0);
  const qualifiedAskUsd = Number(candidate?.qualifiedAskUsd ?? currentAskUsd);
  const offerId = candidate?.currentOfferId || candidate?.recommendedOfferId || 'transparency-audit';
  const customerId = candidate?.id ?? '<customer-or-prospect-id>';
  const evidencePlaceholder = candidate?.invoiceEvidencePlaceholder ?? '<invoice-request-evidence-url-or-reference>';
  const status = sprintStatusFor({ inboundInvoiceRequests, invoiceRequested, contacted, outreachApproved });

  return {
    status,
    objective,
    planningBtcUsd,
    candidate,
    nextEvidenceGate: nextEvidenceGateFor(status),
    reserveImpactIfCurrentAskClosesSats: usdToSats({
      usd: currentAskUsd,
      btcUsd: Number(planningBtcUsd)
    }).toString(),
    reserveImpactIfQualifiedUpgradeClosesSats: usdToSats({
      usd: Math.max(currentAskUsd, qualifiedAskUsd),
      btcUsd: Number(planningBtcUsd)
    }).toString(),
    commands: sprintCommandsFor({
      status,
      current,
      offerId,
      customerId,
      evidencePlaceholder
    }),
    stopRule:
      'Stop at the next evidence gate. Do not send payment instructions, approve invoices, count reserve progress, or move assets from this sprint.'
  };
}

function sprintCandidateFor({ item, revenuePlan }) {
  if (item.leadId) {
    return {
      id: item.leadId,
      type: 'inbound-invoice-request',
      currentOfferId: item.requestedOfferId,
      recommendedOfferId: item.requestedOfferId,
      currentAskUsd: priceForOffer({ offerId: item.requestedOfferId, revenuePlan }),
      qualifiedAskUsd: priceForOffer({ offerId: item.requestedOfferId, revenuePlan }),
      evidenceRequired: 'Inbound lead evidence plus explicit customer invoice request.',
      invoiceEvidencePlaceholder: item.evidence || '<inbound-invoice-request-evidence>'
    };
  }
  if (item.requestedOfferId) {
    return {
      id: item.prospectId,
      type: 'outbound-invoice-request-recorded',
      currentOfferId: item.requestedOfferId,
      recommendedOfferId: item.requestedOfferId,
      currentAskUsd: priceForOffer({ offerId: item.requestedOfferId, revenuePlan }),
      qualifiedAskUsd: priceForOffer({ offerId: item.requestedOfferId, revenuePlan }),
      evidenceRequired: 'Recorded invoice request evidence plus prior contact evidence.',
      invoiceEvidencePlaceholder: item.requestEvidence || '<invoice-request-evidence-url-or-reference>'
    };
  }
  if (item.contactEvidence !== undefined) {
    return {
      id: item.prospectId,
      type: 'contacted-awaiting-invoice-request',
      currentOfferId: item.recommendedOfferId,
      recommendedOfferId: item.recommendedOfferId,
      currentAskUsd: priceForOffer({ offerId: item.recommendedOfferId, revenuePlan }),
      qualifiedAskUsd: priceForOffer({ offerId: item.recommendedOfferId, revenuePlan }),
      evidenceRequired: 'Customer reply explicitly asking for an invoice.',
      invoiceEvidencePlaceholder: '<invoice-request-evidence-url-or-reference>'
    };
  }
  return {
    id: item.prospectId,
    type: 'approved-outreach-awaiting-contact',
    currentOfferId: item.currentOfferId,
    recommendedOfferId: item.recommendedOfferId,
    currentAskUsd: item.currentAskUsd,
    qualifiedAskUsd: item.qualifiedRevenueUsd ?? item.recommendedAskUsd ?? item.currentAskUsd,
    evidenceRequired: 'Manual send evidence before the prospect can be treated as contacted.',
    invoiceEvidencePlaceholder: '<invoice-request-evidence-url-or-reference>',
    contactEvidenceFormUrl: CONTACT_EVIDENCE_INTAKE_URL,
    approvedMessage: item.approvedMessage,
    approvedMessageSha256: item.approvedMessageSha256
  };
}

function sprintStatusFor({ inboundInvoiceRequests, invoiceRequested, contacted, outreachApproved }) {
  if (inboundInvoiceRequests[0]) return 'ready-for-inbound-chairman-review-packet';
  if (invoiceRequested[0]) return 'ready-for-outbound-chairman-review-packet';
  if (contacted[0]) return 'awaiting-explicit-customer-invoice-request';
  if (outreachApproved[0]) return 'awaiting-manual-contact-send';
  return 'no-revenue-conversion-candidate';
}

function nextEvidenceGateFor(status) {
  switch (status) {
    case 'ready-for-inbound-chairman-review-packet':
      return 'Render the inbound invoice request packet for chairman review.';
    case 'ready-for-outbound-chairman-review-packet':
      return 'Render the outbound invoice request packet for chairman review.';
    case 'awaiting-explicit-customer-invoice-request':
      return 'Record only a customer reply that explicitly asks for an invoice.';
    case 'awaiting-manual-contact-send':
      return 'Send the approved outreach manually and record durable contact evidence.';
    default:
      return 'Create or qualify a compliant revenue lead before invoice work.';
  }
}

function sprintCommandsFor({ status, current, offerId, customerId, evidencePlaceholder }) {
  if (!current) {
    return [
      {
        label: 'Find candidate',
        reason: 'No conversion candidate is currently available.',
        command: 'npm run ops:cycle-plan'
      }
    ];
  }
  if (status === 'ready-for-inbound-chairman-review-packet') {
    return [
      {
        label: 'Render inbound review packet',
        reason: 'The customer already asked for an invoice through an inbound path.',
        command: current.renderCommand
      }
    ];
  }
  if (status === 'ready-for-outbound-chairman-review-packet') {
    return [
      {
        label: 'Render outbound review packet',
        reason: 'The prospect is already invoice-requested; prepare chairman quote inputs.',
        command: current.renderCommand
      },
      quoteCommand({ offerId, customerId }),
      writeDraftCommand({ offerId, customerId, evidencePlaceholder })
    ];
  }
  if (status === 'awaiting-explicit-customer-invoice-request') {
    return [
      {
        label: 'Record invoice request evidence',
        reason: 'Use this only after the contacted customer explicitly asks for an invoice.',
        command: current.recordInvoiceRequestCommand
      },
      {
        label: 'Render outbound review packet',
        reason: 'After recording the request, prepare chairman quote inputs.',
        command: `node scripts/sats-invoice-request-agent.mjs render --prospects "${customerId}"`
      }
    ];
  }
  return [
    {
      label: 'Record manual contact evidence',
      reason: 'The top prospect still needs a durable record that approved outreach was sent.',
      command: current.recordSentContactCommand
    },
    {
      label: 'Wait for explicit invoice request',
      reason: 'Payment instructions stay locked until the customer asks for an invoice.',
      command: 'npm run ops:prospect-response-plan'
    }
  ];
}

function quoteCommand({ offerId, customerId }) {
  return {
    label: 'Preview exact-sats quote',
    reason: 'Preview only with a chairman-selected BTC/USD rate and source.',
    command: `node scripts/sats-invoice-quote-agent.mjs quote-template --offer ${offerId} --customer "${customerId}" --btcUsd "<chairman-selected-rate>" --source "<quote-source>"`
  };
}

function writeDraftCommand({ offerId, customerId, evidencePlaceholder }) {
  return {
    label: 'Stage draft for chairman approval',
    reason: 'Stages a draft invoice and approval item only; it does not send payment instructions.',
    command: `node scripts/sats-invoice-quote-agent.mjs write-draft --offer ${offerId} --customer "${customerId}" --btcUsd "<chairman-selected-rate>" --source "<quote-source>" --evidence "${evidencePlaceholder}"`
  };
}

function priceForOffer({ offerId, revenuePlan }) {
  const plannedPrice = (revenuePlan?.revenueStreams ?? []).find(
    (stream) => stream.id === offerId
  )?.priceUsd;
  if (plannedPrice) return plannedPrice;
  switch (offerId) {
    case 'transparency-report-setup':
      return '150';
    case 'full-proof-dashboard':
      return '300';
    default:
      return '50';
  }
}

function usdToSats({ usd, btcUsd }) {
  if (!Number.isFinite(usd) || !Number.isFinite(btcUsd) || usd <= 0 || btcUsd <= 0) return 0n;
  return BigInt(Math.ceil((usd / btcUsd) * 100_000_000));
}

function nextReplyAction({
  inboundInvoiceRequests,
  invoiceRequested,
  contacted,
  sentPackets,
  readyPackets,
  status
}) {
  if (inboundInvoiceRequests[0]) {
    return `Render chairman review packet for inbound invoice request ${inboundInvoiceRequests[0].leadId}.`;
  }
  if (invoiceRequested[0]) {
    return `Render outbound invoice request packet for ${invoiceRequested[0].prospectId}.`;
  }
  if (contacted[0]) {
    return `Wait for explicit invoice request evidence from ${contacted[0].prospectId}; record it only if the customer asks.`;
  }
  if (sentPackets[0]) {
    return `Review replies for sent outreach packet ${sentPackets[0].id}; record contact/invoice evidence only when durable evidence exists.`;
  }
  if (readyPackets[0]) {
    return `Send ${readyPackets[0].id} exactly as approved, then record contact evidence.`;
  }
  return status.nextAction;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeReplyConversionBrief(brief) {
  const jsonPath = join('public', 'reply-conversion-brief.json');
  const markdownPath = join('public', 'reply-conversion-brief.md');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(brief, null, 2)}\n`),
    writeFile(markdownPath, renderReplyConversionMarkdown(brief))
  ]);
  console.log(
    JSON.stringify(
      {
        wrote: [jsonPath, markdownPath],
        eligibleContactRecording: brief.eligibleContactRecording.length,
        eligibleInvoiceRequestRecording: brief.eligibleInvoiceRequestRecording.length
      },
      null,
      2
    )
  );
}
