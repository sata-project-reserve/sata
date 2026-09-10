import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralPartnerHandoffPlan } from './lib/referral-partner-handoffs.mjs';

const EVIDENCE_INTAKE_URL =
  'https://github.com/sata-project-reserve/sata/issues/new?template=referral-handoff-evidence.yml';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan'] = process.argv;
  const [queue, paidPromotionLedger, referralPartnerPolicy, inboundQueue, packetArtifact] =
    await Promise.all([
      readJson(join('public', 'referral-partner-handoff-queue.json')),
      readJson(join('public', 'paid-promotion-ledger.json')),
      readJson(join('public', 'referral-partner-policy.json')),
      readJson(join('public', 'inbound-service-lead-queue.json')),
      readOptionalJson(join('public', 'referral-partner-handoff-packet.json'))
    ]);
  const brief = buildReferralHandoffDispatchBrief({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    packetArtifact
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
