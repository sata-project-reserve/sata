import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralHandoffResponseEvidenceDraft } from './lib/referral-handoff-response-evidence-parser.mjs';

const QUEUE_PATH = join('public', 'referral-partner-handoff-queue.json');
const COMMENT_MARKER = '<!-- sata-referral-handoff-response-evidence-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const queue = await readJson(QUEUE_PATH);

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], queue);
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], queue);
      break;
    default:
      throw new Error(
        `Unknown referral handoff response evidence comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
      );
  }
}

async function commentFromEventJson(path, queue) {
  if (!path) throw new Error('Missing GitHub event JSON path.');
  const event = await readJson(path);
  if (!event.issue) throw new Error('GitHub event JSON does not include an issue payload.');
  printComment(event.issue, queue);
}

async function commentFromIssueJson(path, queue) {
  if (!path) throw new Error('Missing issue JSON path.');
  printComment(await readJson(path), queue);
}

function printComment(issue, queue) {
  const draft = buildReferralHandoffResponseEvidenceDraft({ issue, queue });
  console.log(renderReferralHandoffResponseEvidenceComment(draft));
}

export function renderReferralHandoffResponseEvidenceComment(draft) {
  const status = draft.readyToRecord
    ? 'Ready to record referral handoff response with the local operator command below.'
    : `Not ready to record. Findings: ${draft.findings.join('; ')}`;

  return [
    COMMENT_MARKER,
    '## SATA Referral Handoff Response Evidence Review',
    '',
    `Status: ${status}`,
    '',
    'No compensation, invoice, payment instruction, paid work, token grant, public post, or asset movement has been approved by this automation.',
    '',
    'Parsed evidence:',
    `- Handoff: ${safeValue(draft.intake.handoffId)}`,
    `- Accepted: ${safeValue(draft.intake.partnerAccepted)}`,
    `- Evidence: ${safeValue(draft.intake.responseEvidenceUrl || draft.issueUrl)}`,
    '',
    draft.operatorCommand ? 'Operator command:' : 'Operator command not prepared:',
    draft.operatorCommand ? '```sh' : '- Fix findings first.',
    draft.operatorCommand,
    draft.operatorCommand ? '```' : null,
    '',
    `Next required action: ${draft.nextRequiredAction}`,
    '',
    'Boundaries:',
    '- Run the command only after confirming the issue evidence is durable and the response belongs to the named handoff.',
    '- Acceptance only opens the referred-lead evidence step; it does not approve compensation.',
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
