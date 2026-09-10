import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralHandoffEvidenceDraft } from './lib/referral-handoff-evidence-parser.mjs';

const QUEUE_PATH = join('public', 'referral-partner-handoff-queue.json');
const PAID_PROMOTION_PATH = join('public', 'paid-promotion-ledger.json');
const REFERRAL_POLICY_PATH = join('public', 'referral-partner-policy.json');
const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');
const COMMENT_MARKER = '<!-- sata-referral-handoff-evidence-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const context = await readContext();

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], context);
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], context);
      break;
    default:
      throw new Error(
        `Unknown referral handoff evidence comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
      );
  }
}

async function commentFromEventJson(path, context) {
  if (!path) throw new Error('Missing GitHub event JSON path.');
  const event = await readJson(path);
  if (!event.issue) throw new Error('GitHub event JSON does not include an issue payload.');
  printComment(event.issue, context);
}

async function commentFromIssueJson(path, context) {
  if (!path) throw new Error('Missing issue JSON path.');
  printComment(await readJson(path), context);
}

function printComment(issue, context) {
  const draft = buildReferralHandoffEvidenceDraft({ issue, ...context });
  console.log(renderReferralHandoffEvidenceComment(draft));
}

export function renderReferralHandoffEvidenceComment(draft) {
  const status = draft.readyToRecord
    ? 'Ready to record referral handoff evidence with the local operator command below.'
    : `Not ready to record. Findings: ${draft.findings.join('; ')}`;

  return [
    COMMENT_MARKER,
    '## SATA Referral Handoff Evidence Review',
    '',
    `Status: ${status}`,
    '',
    'No partner, compensation, invoice, payment instruction, paid work, token grant, public post, or asset movement has been approved by this automation.',
    '',
    'Parsed evidence:',
    `- Campaign: ${safeValue(draft.intake.campaignId)}`,
    `- Partner handle: ${safeValue(draft.intake.partnerHandle)}`,
    `- Evidence: ${safeValue(draft.intake.sentEvidenceUrl || draft.issueUrl)}`,
    `- Approved terms SHA-256: ${safeValue(draft.intake.approvedTermsSha256)}`,
    `- Terms match approved packet: ${draft.termsMatchApprovedPacket}`,
    `- Hash matches approved packet: ${draft.hashMatchesApprovedPacket}`,
    '',
    draft.operatorCommand ? 'Operator command:' : 'Operator command not prepared:',
    draft.operatorCommand ? '```sh' : '- Fix findings first.',
    draft.operatorCommand,
    draft.operatorCommand ? '```' : null,
    '',
    `Next required action: ${draft.nextRequiredAction}`,
    '',
    'Boundaries:',
    '- Run the command only after confirming the issue evidence is durable and the terms were actually sent.',
    '- Do not approve compensation until a referred customer pays and the receipt is confirmed.',
    '- Do not send payment instructions or quote inputs until the customer explicitly asks for an invoice and the Executive Chairman approves the exact-sats invoice.',
    '- Do not add price, return, buyer, liquidity, investment, market-support, or guaranteed-result claims.'
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function safeValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || 'Not provided';
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
