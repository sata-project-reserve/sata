import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralLeadEvidenceDraft } from './lib/referral-lead-evidence-parser.mjs';

const HANDOFF_QUEUE_PATH = join('public', 'referral-partner-handoff-queue.json');
const COMMENT_MARKER = '<!-- sata-referral-lead-evidence-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const handoffQueue = await readJson(HANDOFF_QUEUE_PATH);

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], handoffQueue);
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], handoffQueue);
      break;
    default:
      throw new Error(
        `Unknown referral lead evidence comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
      );
  }
}

async function commentFromEventJson(path, handoffQueue) {
  if (!path) throw new Error('Missing GitHub event JSON path.');
  const event = await readJson(path);
  if (!event.issue) throw new Error('GitHub event JSON does not include an issue payload.');
  printComment(event.issue, handoffQueue);
}

async function commentFromIssueJson(path, handoffQueue) {
  if (!path) throw new Error('Missing issue JSON path.');
  printComment(await readJson(path), handoffQueue);
}

function printComment(issue, handoffQueue) {
  const draft = buildReferralLeadEvidenceDraft({ issue, handoffQueue });
  console.log(renderReferralLeadEvidenceComment(draft));
}

export function renderReferralLeadEvidenceComment(draft) {
  const status = draft.readyToRecord
    ? 'Ready to record referred inbound lead with the local operator command below.'
    : `Not ready to record. Findings: ${draft.findings.join('; ')}`;

  return [
    COMMENT_MARKER,
    '## SATA Referral Lead Evidence Review',
    '',
    `Status: ${status}`,
    '',
    'No compensation, invoice, payment instruction, paid work, token grant, public post, or asset movement has been approved by this automation.',
    '',
    'Parsed evidence:',
    `- Handoff: ${safeValue(draft.intake.handoffId)}`,
    `- Customer lead: ${safeValue(draft.intake.customerLeadId)}`,
    `- Customer asked for invoice: ${safeValue(draft.intake.customerAskedForInvoice)}`,
    `- Evidence: ${safeValue(draft.intake.referralEvidenceUrl || draft.issueUrl)}`,
    '',
    draft.operatorCommand ? 'Operator command:' : 'Operator command not prepared:',
    draft.operatorCommand ? '```sh' : '- Fix findings first.',
    draft.operatorCommand,
    draft.operatorCommand ? '```' : null,
    '',
    `Next required action: ${draft.nextRequiredAction}`,
    '',
    'Boundaries:',
    '- Run the command only after confirming the issue evidence is durable and belongs to an accepted referral handoff.',
    '- Recording a referred lead does not approve referral compensation.',
    '- Do not send payment instructions until the customer explicitly asks for an invoice and the Executive Chairman approves the exact-sats invoice.',
    '- Do not add price, return, buyer, liquidity, investment, market-support, or guaranteed-result claims.'
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function safeValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || 'Not provided';
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
