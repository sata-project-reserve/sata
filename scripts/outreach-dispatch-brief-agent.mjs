import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prioritizeOutreachPackets } from './lib/prospect-priority.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const options = parseOptions(args);
  const [status, packetQueue, approvalQueue, revenuePlan, prospectPipeline] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'service-outreach-packet-queue.json')),
    readJson(join('public', 'executive-approval-queue.json')),
    readJson(join('public', 'revenue-operating-plan.json')),
    readJson(join('public', 'sats-prospect-pipeline.json'))
  ]);
  const brief = buildOutreachDispatchBrief({
    status,
    packetQueue,
    approvalQueue,
    revenuePlan,
    prospectPipeline,
    maxManualSends: options.max ? Number(options.max) : undefined
  });

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(brief, null, 2));
      break;
    case 'markdown':
      console.log(renderOutreachDispatchMarkdown(brief));
      break;
    case 'write':
      await writeOutreachDispatchBrief(brief);
      break;
    default:
      throw new Error(
        `Unknown outreach dispatch brief command: ${command}. Use plan, json, markdown, or write.`
      );
  }
}

export function buildOutreachDispatchBrief({
  status,
  packetQueue,
  approvalQueue,
  revenuePlan,
  prospectPipeline = null,
  maxManualSends = 5,
  generatedAtUtc = new Date().toISOString()
}) {
  if (!Number.isSafeInteger(maxManualSends) || maxManualSends < 1 || maxManualSends > 20) {
    throw new Error('maxManualSends must be an integer from 1 to 20.');
  }
  const prospectsById = new Map(
    (prospectPipeline?.prospects ?? []).map((prospect) => [prospect.id, prospect])
  );
  const revenueStreamsById = new Map(
    (revenuePlan?.revenueStreams ?? []).map((stream) => [stream.id, stream])
  );
  const readyPackets = prioritizeOutreachPackets({
    packets: (packetQueue.packets ?? [])
      .filter((packet) => packet.status === 'ready-for-manual-send')
      .map((packet) => ({
        packetId: packet.id,
        prospectId: packet.prospectId,
        offerId: packet.offerId,
        channel: packet.channel,
        destination: packet.destination,
        tracking: packet.tracking ?? null,
        message: packet.message,
        recordContactCommand: withSentAtUtcPlaceholder(packet.recordContactCommand, packet.id),
        targetRevenueUsd: offerPriceUsd({ revenuePlan, offerId: packet.offerId }),
        trackingLabel: `manual_outreach:${packet.id}`,
        boundary: packet.boundary,
        ...commercialContextFor({
          packet,
          prospect: prospectsById.get(packet.prospectId),
          revenuePlan,
          revenueStreamsById
        })
      })),
    prospectPipeline,
    revenuePlan
  });
  const sprintPackets = readyPackets.slice(0, maxManualSends);
  const reserveAllocationPercent =
    revenuePlan?.allocationPolicy?.postReceiptAllocationPercent?.btcReserve ?? 70;
  const planningBtcUsd = 100000;
  const sprintGrossRevenueUsd = sprintPackets.reduce(
    (total, packet) => total + Number(packet.targetRevenueUsd),
    0
  );
  const sprintQualifiedRevenueUsd = sprintPackets.reduce(
    (total, packet) => total + Number(packet.qualifiedRevenueUsd ?? packet.targetRevenueUsd),
    0
  );
  const sprintReserveAllocationUsd =
    (sprintGrossRevenueUsd * Number(reserveAllocationPercent)) / 100;
  const sprintQualifiedReserveAllocationUsd =
    (sprintQualifiedRevenueUsd * Number(reserveAllocationPercent)) / 100;
  const sprintReserveSatsAtPlanningRate = Math.floor(
    (sprintReserveAllocationUsd / planningBtcUsd) * 100_000_000
  );
  const sprintQualifiedReserveSatsAtPlanningRate = Math.floor(
    (sprintQualifiedReserveAllocationUsd / planningBtcUsd) * 100_000_000
  );
  const pendingOutreachApprovals = (approvalQueue.items ?? [])
    .filter(
      (item) =>
        item.status === 'ready-for-chairman-review' && item.id?.startsWith('outreach-approval-')
    )
    .map((item) => ({
      approvalId: item.id,
      title: item.title,
      prospectIds: prospectIdsFromOutreachApprovalTitle(item.title),
      approveCommand: `npm run ops:approve -- ${item.id} --confirm-chairman-approval "I am Executive Chairman and approve ${item.id}"`,
      evidenceCount: item.evidence?.length ?? 0,
      boundary:
        'Approval records a chairman decision only; it does not contact prospects, approve invoices, move assets, or make public commitments.'
    }));

  return {
    project: status.project,
    mode: 'manual-outreach-dispatch-brief',
    generatedAtUtc,
    reserve: status.currentReserve,
    maxManualSends,
    readyManualSendCount: readyPackets.length,
    queuedRemainderCount: Math.max(readyPackets.length - sprintPackets.length, 0),
    readyManualSends: sprintPackets,
    sprintEconomics: {
      planningBtcUsd: String(planningBtcUsd),
      reserveAllocationPercent: String(reserveAllocationPercent),
      grossRevenueUsd: String(sprintGrossRevenueUsd),
      qualifiedGrossRevenueUsd: String(sprintQualifiedRevenueUsd),
      reserveAllocationUsd: sprintReserveAllocationUsd.toFixed(2),
      qualifiedReserveAllocationUsd: sprintQualifiedReserveAllocationUsd.toFixed(2),
      reserveSatsAtPlanningRate: String(sprintReserveSatsAtPlanningRate),
      qualifiedReserveSatsAtPlanningRate: String(sprintQualifiedReserveSatsAtPlanningRate),
      grossRevenueBasis:
        'grossRevenueUsd is the current approved starter-offer path; qualifiedGrossRevenueUsd is upgrade-path planning only.',
      firstConversionGoal:
        'Get one explicit invoice request from this manual sprint before expanding spend or outreach volume.',
      measurementRule:
        'Count only durable contact evidence, replies, invoice requests, approved invoices, confirmed receipts, and post-receipt allocation proposals.'
    },
    prioritizationRule:
      'Prioritize higher-value setup/dashboard fit, reserve/custody claims, authority/liquidity claims, tooling/platform fit, evidence depth, and chairman-approved outreach paths.',
    pendingOutreachApprovals,
    dispatchRule:
      'Run one focused manual sprint: send the listed packets exactly as approved, record evidence after each send, then stop and review replies before expanding the batch.',
    nextAction: sprintPackets[0]?.packetId
      ? `Send ${sprintPackets[0].packetId} exactly as approved, then record contact evidence.`
      : pendingOutreachApprovals[0]?.approvalId
        ? `Chairman decision needed for ${pendingOutreachApprovals[0].approvalId}.`
        : status.nextAction,
    boundary:
      'This brief is for manual dispatch coordination only. It does not approve outreach, contact prospects, send invoices, request payment, move assets, grant tokens, or make public commitments.'
  };
}

export function renderOutreachDispatchMarkdown(brief) {
  const lines = [
    `# ${brief.project} Outreach Dispatch Brief`,
    '',
    `Generated: ${brief.generatedAtUtc}`,
    `Reserve: ${brief.reserve.confirmedSats} sats confirmed, ${brief.reserve.remainingSats} sats remaining.`,
    '',
    '## Boundary',
    brief.boundary,
    '',
    '## Ready Manual Sends',
    `Sprint: ${brief.readyManualSends.length} of ${brief.readyManualSendCount} ready packets. Backlog after this sprint: ${brief.queuedRemainderCount}.`,
    '',
    brief.dispatchRule,
    '',
    '## Sprint Economics',
    `Gross service target if current approved asks convert: $${brief.sprintEconomics.grossRevenueUsd}.`,
    `Qualified upgrade path if scoped customers convert: $${brief.sprintEconomics.qualifiedGrossRevenueUsd}.`,
    `Reserve allocation target at ${brief.sprintEconomics.reserveAllocationPercent}%: $${brief.sprintEconomics.reserveAllocationUsd} current / $${brief.sprintEconomics.qualifiedReserveAllocationUsd} qualified.`,
    `Planning reserve impact at BTC/USD ${brief.sprintEconomics.planningBtcUsd}: ${brief.sprintEconomics.reserveSatsAtPlanningRate} sats.`,
    `Qualified planning reserve impact: ${brief.sprintEconomics.qualifiedReserveSatsAtPlanningRate} sats.`,
    brief.sprintEconomics.grossRevenueBasis,
    brief.sprintEconomics.firstConversionGoal,
    brief.sprintEconomics.measurementRule
  ];
  if (brief.readyManualSends.length === 0) {
    lines.push('No outreach packets are ready for manual send.');
  }
  for (const packet of brief.readyManualSends) {
    lines.push(
      '',
      `### ${packet.prospectId}`,
      `Packet: ${packet.packetId}`,
      `Offer: ${packet.offerId} / $${packet.targetRevenueUsd}`,
      `Current approved ask: ${packet.currentOfferId} / $${packet.currentAskUsd}`,
      ...(packet.qualifiedRevenueUsd &&
      Number(packet.qualifiedRevenueUsd) > Number(packet.targetRevenueUsd)
        ? [`Qualified revenue path: $${packet.qualifiedRevenueUsd}`]
        : []),
      ...(packet.conversionPlan?.upgradeOfferId
        ? [`Upgrade path: ${packet.conversionPlan.upgradeOfferId} only after explicit fit`]
        : []),
      `Priority: ${packet.priority.score} / ${packet.priority.tier} - ${packet.priority.reasons.join('; ')}`,
      `Tracking: ${packet.trackingLabel}`,
      ...(packet.tracking?.serviceUrl ? [`Tracked service: ${packet.tracking.serviceUrl}`] : []),
      ...(packet.tracking?.sampleAuditUrl ? [`Tracked sample: ${packet.tracking.sampleAuditUrl}`] : []),
      ...(packet.tracking?.intakeUrl ? [`Tracked intake: ${packet.tracking.intakeUrl}`] : []),
      `Destination: ${packet.destination.publicProfileUrl}`,
      '',
      '```text',
      packet.message,
      '```',
      '',
      'After manual send, record durable evidence:',
      '',
      '```sh',
      packet.recordContactCommand,
      '```'
    );
  }

  lines.push('', '## Pending Chairman Outreach Approvals');
  if (brief.pendingOutreachApprovals.length === 0) {
    lines.push('No outreach approval packets are pending.');
  }
  for (const item of brief.pendingOutreachApprovals) {
    lines.push(
      '',
      `### ${item.approvalId}`,
      item.title,
      `Prospects: ${item.prospectIds.join(', ')}`,
      `Evidence records: ${item.evidenceCount}`,
      '',
      '```sh',
      item.approveCommand,
      '```'
    );
  }

  lines.push('', '## Next Action', brief.nextAction);
  return `${lines.join('\n')}\n`;
}

function offerPriceUsd({ revenuePlan, offerId }) {
  const stream = (revenuePlan?.revenueStreams ?? []).find((item) => item.id === offerId);
  return stream?.priceUsd ?? '0';
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

function withSentAtUtcPlaceholder(command, packetId) {
  const value = String(
    command ??
      `node scripts/service-outreach-packet-agent.mjs mark-sent --packet ${packetId} --evidence "<contact-evidence-url-or-reference>" --messageHash "<approved-message-sha256>"`
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

function prospectIdsFromOutreachApprovalTitle(title) {
  const match = /^Approve factual outreach to (?<ids>.+)$/i.exec(title ?? '');
  return (match?.groups?.ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeOutreachDispatchBrief(brief) {
  const jsonPath = join('public', 'outreach-dispatch-brief.json');
  const markdownPath = join('public', 'outreach-dispatch-brief.md');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(brief, null, 2)}\n`),
    writeFile(markdownPath, renderOutreachDispatchMarkdown(brief))
  ]);
  console.log(
    JSON.stringify(
      { wrote: [jsonPath, markdownPath], readyManualSends: brief.readyManualSends.length },
      null,
      2
    )
  );
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}.`);
    options[key.slice(2)] = collected.join(' ');
  }
  return options;
}
