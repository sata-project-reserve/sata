import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildReferralPartnerHandoffPlan,
  recordReferralHandoffResponse,
  recordReferralHandoffSent
} from './lib/referral-partner-handoffs.mjs';
import { renderReferralPartnerPacket } from './referral-partner-packet-agent.mjs';
import { writeRevenueCyclePublicStatus } from './lib/revenue-cycle-public-state.mjs';

const QUEUE_PATH = join('public', 'referral-partner-handoff-queue.json');
const PAID_PROMOTION_PATH = join('public', 'paid-promotion-ledger.json');
const REFERRAL_POLICY_PATH = join('public', 'referral-partner-policy.json');
const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');
const PACKET_JSON_PATH = join('public', 'referral-partner-handoff-packet.json');
const PACKET_MARKDOWN_PATH = join('public', 'referral-partner-handoff-packet.md');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command = 'plan', ...args] = process.argv.slice(2);
  const options = parseArgs(args);
  const [queue, paidPromotionLedger, referralPartnerPolicy, inboundQueue] = await Promise.all([
    readJson(QUEUE_PATH),
    readJson(PAID_PROMOTION_PATH),
    readJson(REFERRAL_POLICY_PATH),
    readJson(INBOUND_QUEUE_PATH)
  ]);
  const inputs = { queue, paidPromotionLedger, referralPartnerPolicy, inboundQueue };

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(buildReferralPartnerHandoffPlan(inputs), null, 2));
      break;
    case 'render':
    case 'markdown':
      renderCandidate(inputs, options);
      break;
    case 'write-packet':
      await writeCandidatePacket(inputs, options);
      break;
    case 'record-sent':
      await writeQueue(
        recordReferralHandoffSent({
          queue,
          paidPromotionLedger,
          referralPartnerPolicy,
          inboundQueue,
          campaignId: options.campaign,
          sentEvidence: options.evidence,
          sentAtUtc: options.sentAtUtc,
          requestedCompensation: options.requestedCompensation,
          messageHash: options.messageHash
        })
      );
      break;
    case 'record-response':
      await writeQueue(
        recordReferralHandoffResponse({
          queue,
          handoffId: options.handoff,
          accepted: options.accepted,
          evidence: options.evidence,
          respondedAtUtc: options.respondedAtUtc
        })
      );
      break;
    default:
      throw new Error(
        `Unknown referral handoff command: ${command}. Use plan, render, write-packet, record-sent, or record-response.`
      );
  }
}

function renderCandidate(inputs, options) {
  const candidate = selectCandidate(inputs, options);
  console.log(renderReferralPartnerPacket(candidate.packet));
  console.log('');
  console.log('## Record Sent Evidence');
  console.log('');
  console.log('```sh');
  console.log(candidate.recordSentCommand);
  console.log('```');
}

async function writeCandidatePacket(inputs, options) {
  const candidate = selectCandidate(inputs, options);
  const artifact = {
    project: inputs.queue.project,
    mode: 'referral-partner-handoff-packet',
    generatedAtUtc: candidate.packet.generatedAtUtc,
    sourceCampaignId: candidate.sourceCampaignId,
    partner: candidate.partner,
    sourceEvidence: candidate.sourceEvidence,
    packet: candidate.packet,
    recordSentCommand: candidate.recordSentCommand,
    boundary:
      'This artifact renders approved referral terms for manual review. It does not record a send, approve compensation, issue an invoice, provide payment instructions, grant tokens, or move assets.'
  };
  await Promise.all([
    writeFile(PACKET_JSON_PATH, `${JSON.stringify(artifact, null, 2)}\n`),
    writeFile(
      PACKET_MARKDOWN_PATH,
      [
        renderReferralPartnerPacket(candidate.packet),
        '',
        '## Record Sent Evidence',
        '',
        '```sh',
        candidate.recordSentCommand,
        '```',
        '',
        '## Artifact Boundary',
        artifact.boundary,
        ''
      ].join('\n')
    )
  ]);
  console.log(
    JSON.stringify(
      {
        wrote: [PACKET_JSON_PATH, PACKET_MARKDOWN_PATH],
        sourceCampaignId: candidate.sourceCampaignId,
        partner: candidate.partner.displayName,
        recordSentCommand: candidate.recordSentCommand
      },
      null,
      2
    )
  );
}

function selectCandidate(inputs, options) {
  const plan = buildReferralPartnerHandoffPlan(inputs);
  const campaignId = options.campaign;
  const candidate = campaignId
    ? plan.candidates.find((item) => item.sourceCampaignId === campaignId)
    : plan.candidates[0];
  if (!candidate) throw new Error(`No eligible referral handoff candidate found: ${campaignId ?? '<first>'}`);
  return candidate;
}

async function writeQueue(nextQueue) {
  await writeFile(QUEUE_PATH, `${JSON.stringify(nextQueue, null, 2)}\n`);
  await writeRevenueCyclePublicStatus();
  const [queue, paidPromotionLedger, referralPartnerPolicy, inboundQueue] = await Promise.all([
    readJson(QUEUE_PATH),
    readJson(PAID_PROMOTION_PATH),
    readJson(REFERRAL_POLICY_PATH),
    readJson(INBOUND_QUEUE_PATH)
  ]);
  console.log(
    JSON.stringify(
      buildReferralPartnerHandoffPlan({
        queue,
        paidPromotionLedger,
        referralPartnerPolicy,
        inboundQueue
      }),
      null,
      2
    )
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const collected = [];
    while (args[index + 1] && !args[index + 1].startsWith('--')) {
      collected.push(args[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${token}`);
    options[key] = collected.join(' ');
  }
  return options;
}
