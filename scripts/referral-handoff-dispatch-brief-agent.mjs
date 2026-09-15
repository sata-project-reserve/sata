import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralPartnerHandoffPlan } from './lib/referral-partner-handoffs.mjs';

const EVIDENCE_INTAKE_URL =
  'https://github.com/sata-project-reserve/sata/issues/new?template=referral-handoff-evidence.yml';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan'] = process.argv;
  const [
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    packetArtifact,
    revenuePlan
  ] =
    await Promise.all([
      readJson(join('public', 'referral-partner-handoff-queue.json')),
      readJson(join('public', 'paid-promotion-ledger.json')),
      readJson(join('public', 'referral-partner-policy.json')),
      readJson(join('public', 'inbound-service-lead-queue.json')),
      readOptionalJson(join('public', 'referral-partner-handoff-packet.json')),
      readJson(join('public', 'revenue-operating-plan.json'))
    ]);
  const brief = buildReferralHandoffDispatchBrief({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    packetArtifact,
    revenuePlan
  });

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(brief, null, 2));
      break;
    case 'markdown':
      console.log(renderReferralHandoffDispatchMarkdown(brief));
      break;
    case 'write':
      await writeReferralHandoffDispatchBrief(brief);
      break;
    default:
      throw new Error(
        `Unknown referral handoff dispatch command: ${command}. Use plan, json, markdown, or write.`
      );
  }
}

export function buildReferralHandoffDispatchBrief({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  packetArtifact = null,
  revenuePlan = null,
  generatedAtUtc = new Date().toISOString()
}) {
  const plan = buildReferralPartnerHandoffPlan({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    generatedAtUtc
  });
  const readyManualHandoffs = plan.candidates.slice(0, 3).map((candidate) => {
    const artifactCommand =
      packetArtifact?.sourceCampaignId === candidate.sourceCampaignId
        ? packetArtifact.recordSentCommand
        : '';
    return {
      sourceCampaignId: candidate.sourceCampaignId,
      partner: candidate.partner,
      sourceEvidence: candidate.sourceEvidence,
      artifact: 'public/referral-partner-handoff-packet.md',
      evidenceIssueUrl: EVIDENCE_INTAKE_URL,
      approvedTermsSha256: candidate.packet.termsSha256,
      exactTerms: candidate.packet.replyTemplate,
      reserveImpactPlanning: buildReserveImpactPlanning({ revenuePlan }),
      recordSentCommand: artifactCommand || candidate.recordSentCommand,
      recordReferredLeadCommand: candidate.packet.recordReferredLeadCommand,
      sendInstructions:
        'Send the exact approved terms manually, then record durable sent evidence with the approved terms SHA-256.',
      stopRule:
        'Do not offer upfront compensation, payment instructions, token grants, public posts, invoices, guaranteed results, market support, or asset movement.'
    };
  });
  return {
    project: plan.project,
    mode: 'referral-handoff-manual-dispatch-brief',
    generatedAtUtc,
    totals: plan.totals,
    readyManualHandoffs,
    activeHandoffs: plan.activeHandoffs,
    evidenceIssueUrl: EVIDENCE_INTAKE_URL,
    nextAction:
      readyManualHandoffs[0]?.sourceCampaignId
        ? `Send exact approved referral terms for ${readyManualHandoffs[0].sourceCampaignId}, then submit sent evidence with the approved terms SHA-256.`
        : plan.nextAction,
    boundary:
      'This brief coordinates manual referral handoff dispatch only. It does not send messages, approve partners, approve compensation, issue invoices, provide payment instructions, publish posts, grant tokens, move assets, or record state.'
  };
}

function buildReserveImpactPlanning({ revenuePlan }) {
  const primaryOfferId = revenuePlan?.nextCycle?.primaryOfferId ?? 'transparency-audit';
  const primaryOffer = findRevenueStream(revenuePlan, primaryOfferId);
  const qualifiedOffer = findRevenueStream(revenuePlan, 'transparency-report-setup') ?? primaryOffer;
  const btcUsd = String(revenuePlan?.planningAssumptions?.btcUsd ?? '100000');
  const reserveAllocationPercent = String(
    revenuePlan?.allocationPolicy?.postReceiptAllocationPercent?.btcReserve ?? 70
  );

  return {
    basis: 'planning-only',
    primaryOfferId,
    primaryOfferUsd: String(primaryOffer?.priceUsd ?? '50'),
    qualifiedUpgradeOfferId: qualifiedOffer?.id ?? primaryOfferId,
    qualifiedUpgradeUsd: String(qualifiedOffer?.priceUsd ?? primaryOffer?.priceUsd ?? '50'),
    btcUsd,
    btcUsdSource:
      revenuePlan?.planningAssumptions?.btcUsdSource ??
      'operator planning assumption, not a live quote',
    reserveAllocationPercent,
    primaryOfferReserveSats: estimateReserveSats({
      usd: primaryOffer?.priceUsd ?? '50',
      reserveAllocationPercent,
      btcUsd
    }),
    qualifiedUpgradeReserveSats: estimateReserveSats({
      usd: qualifiedOffer?.priceUsd ?? primaryOffer?.priceUsd ?? '50',
      reserveAllocationPercent,
      btcUsd
    }),
    trigger:
      'Count zero sats until a referred customer pays, the receipt is confirmed, and allocation is chairman-approved.',
    actualSatsRule:
      revenuePlan?.planningAssumptions?.actualSatsRule ??
      'Planning only. Record actual sats only after confirmed receipt and chairman-approved allocation.'
  };
}

function findRevenueStream(revenuePlan, id) {
  return (revenuePlan?.revenueStreams ?? []).find((stream) => stream.id === id) ?? null;
}

function estimateReserveSats({ usd, reserveAllocationPercent, btcUsd }) {
  const usdCents = parseDecimalToScale(String(usd), 2);
  const percentBps = parseDecimalToScale(String(reserveAllocationPercent), 2);
  const btcUsdCents = parseDecimalToScale(String(btcUsd), 2);
  if (btcUsdCents <= 0n) return '0';
  return ((usdCents * percentBps * 100_000_000n) / (10_000n * btcUsdCents)).toString();
}

function parseDecimalToScale(value, decimals) {
  const text = String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return 0n;
  const whole = match[1];
  const fraction = (match[2] ?? '').padEnd(decimals, '0').slice(0, decimals);
  return BigInt(`${whole}${fraction}`);
}

export function renderReferralHandoffDispatchMarkdown(brief) {
  const lines = [
    `# ${brief.project} Referral Handoff Dispatch Brief`,
    '',
    `Generated: ${brief.generatedAtUtc}`,
    '',
    '## Boundary',
    brief.boundary,
    '',
    '## Evidence Intake',
    brief.evidenceIssueUrl,
    '',
    '## Ready Manual Handoffs',
    `Ready candidates: ${brief.readyManualHandoffs.length} of ${brief.totals.unrecordedHandoffCandidates}.`,
    ''
  ];

  if (brief.readyManualHandoffs.length === 0) {
    lines.push('No post-receipt referral handoffs are ready for manual dispatch.');
  }
  for (const item of brief.readyManualHandoffs) {
    lines.push(
      `### ${item.partner.displayName} (@${item.partner.handle})`,
      `Campaign: ${item.sourceCampaignId}`,
      `Source evidence: ${item.sourceEvidence}`,
      `Packet artifact: ${item.artifact}`,
      `Approved terms SHA-256: ${item.approvedTermsSha256}`,
      `Planning reserve impact: ${item.reserveImpactPlanning.primaryOfferReserveSats} sats primary / ${item.reserveImpactPlanning.qualifiedUpgradeReserveSats} sats qualified upgrade`,
      `Planning basis: ${item.reserveImpactPlanning.reserveAllocationPercent}% reserve allocation at BTC/USD ${item.reserveImpactPlanning.btcUsd}`,
      `Planning BTC/USD source: ${item.reserveImpactPlanning.btcUsdSource}.`,
      `Counting rule: ${item.reserveImpactPlanning.trigger}`,
      item.sendInstructions,
      item.stopRule,
      '',
      '```text',
      item.exactTerms,
      '```',
      '',
      'After manual send, submit the evidence issue and record only with the hash-bound command:',
      '',
      '```sh',
      item.recordSentCommand,
      '```',
      '',
      'If the partner later refers a qualified customer:',
      '',
      '```sh',
      item.recordReferredLeadCommand,
      '```',
      ''
    );
  }

  lines.push('## Active Handoffs');
  if (brief.activeHandoffs.length === 0) {
    lines.push('No active referral handoffs are awaiting response or referred-lead evidence.');
  }
  for (const item of brief.activeHandoffs) {
    lines.push(
      '',
      `### ${item.id}`,
      `Status: ${item.status}`,
      `Next action: ${item.nextAction}`,
      '',
      '```sh',
      item.recordResponseCommand,
      '```'
    );
  }

  lines.push('', '## Next Action', brief.nextAction);
  return `${lines.join('\n')}\n`;
}

async function writeReferralHandoffDispatchBrief(brief) {
  const jsonPath = join('public', 'referral-handoff-dispatch-brief.json');
  const markdownPath = join('public', 'referral-handoff-dispatch-brief.md');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(brief, null, 2)}\n`),
    writeFile(markdownPath, renderReferralHandoffDispatchMarkdown(brief))
  ]);
  console.log(
    JSON.stringify(
      { wrote: [jsonPath, markdownPath], readyManualHandoffs: brief.readyManualHandoffs.length },
      null,
      2
    )
  );
}

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
