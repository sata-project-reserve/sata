import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralHandoffEvidenceDraft } from './lib/referral-handoff-evidence-parser.mjs';
import { buildReferralPartnerHandoffPlan } from './lib/referral-partner-handoffs.mjs';

const QUEUE_PATH = join('public', 'referral-partner-handoff-queue.json');
const PAID_PROMOTION_PATH = join('public', 'paid-promotion-ledger.json');
const REFERRAL_POLICY_PATH = join('public', 'referral-partner-policy.json');
const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const context = await readContext();

  switch (command) {
    case 'plan':
      console.log(
        JSON.stringify(
          {
            project: context.queue.project,
            mode: 'referral-handoff-evidence-intake',
            issueTemplate: '.github/ISSUE_TEMPLATE/referral-handoff-evidence.yml',
            templateCommand:
              'node scripts/referral-handoff-evidence-agent.mjs render-template --campaign "<campaign-id>" --evidence "<partner-terms-send-evidence>" --sentAtUtc "<sent-at-utc>"',
            nextAction:
              'After approved referral handoff terms are sent manually, submit the evidence issue and run the rendered record-sent command only if the pasted terms and approved SHA-256 match the packet.',
            boundary:
              'This intake does not send referral terms, approve compensation, approve invoices, send payment instructions, grant tokens, publish posts, or move assets.'
          },
          null,
          2
        )
      );
      break;
    case 'render-template':
      printIssueTemplate(args, context);
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], context);
      break;
    default:
      throw new Error(
        `Unknown referral handoff evidence command: ${command}. Use plan, render-template --campaign <id>, or draft-from-issue-json <path>.`
      );
  }
}

function printIssueTemplate(args, context) {
  const options = parseOptions(args);
  console.log(
    renderReferralHandoffEvidenceIssueBody({
      ...context,
      campaignId: options.campaign,
      sentEvidenceUrl: options.evidence,
      sentAtUtc: options.sentAtUtc
    })
  );
}

export function renderReferralHandoffEvidenceIssueBody({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  campaignId,
  sentEvidenceUrl = '<partner-terms-send-evidence>',
  sentAtUtc = '<sent-at-utc>'
}) {
  const candidate = findReferralHandoffCandidate({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue,
    campaignId
  });
  return [
    '### Source campaign ID',
    candidate.sourceCampaignId,
    '',
    '### Partner handle',
    candidate.partner.handle,
    '',
    '### Sent evidence URL or reference',
    cleanLine(sentEvidenceUrl),
    '',
    '### Approved terms SHA-256',
    candidate.packet.termsSha256,
    '',
    '### Exact referral terms sent',
    candidate.packet.replyTemplate,
    '',
    '### Sent at UTC',
    cleanLine(sentAtUtc)
  ].join('\n');
}

async function draftFromIssueJson(path, context) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildReferralHandoffEvidenceDraft({ issue, ...context }), null, 2));
}

function findReferralHandoffCandidate({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue,
  campaignId
}) {
  const id = cleanLine(campaignId);
  if (!id) throw new Error('Missing --campaign value.');
  const plan = buildReferralHandoffEvidencePlan({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue
  });
  const candidate = plan.candidates.find((item) => item.sourceCampaignId === id);
  if (!candidate) throw new Error(`Referral handoff candidate not found: ${id}`);
  if (!candidate.packet?.replyTemplate || !/^[a-f0-9]{64}$/.test(candidate.packet?.termsSha256 ?? '')) {
    throw new Error(`${id}: candidate must include approved terms and SHA-256.`);
  }
  return candidate;
}

function buildReferralHandoffEvidencePlan({
  queue,
  paidPromotionLedger,
  referralPartnerPolicy,
  inboundQueue
}) {
  return buildReferralPartnerHandoffPlan({
    queue,
    paidPromotionLedger,
    referralPartnerPolicy,
    inboundQueue
  });
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) throw new Error('Options must be provided as --key value pairs.');
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

function cleanLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function readContext() {
  const [queue, paidPromotionLedger, referralPartnerPolicy, inboundQueue] = await Promise.all([
    readJson(QUEUE_PATH),
    readJson(PAID_PROMOTION_PATH),
    readJson(REFERRAL_POLICY_PATH),
    readJson(INBOUND_QUEUE_PATH)
  ]);
  return { queue, paidPromotionLedger, referralPartnerPolicy, inboundQueue };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
