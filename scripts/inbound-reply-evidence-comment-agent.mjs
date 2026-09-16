import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildInboundReplyEvidenceDraft } from './lib/inbound-reply-evidence-parser.mjs';

const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');
const COMMENT_MARKER = '<!-- sata-inbound-reply-evidence-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const queue = await readJson(INBOUND_QUEUE_PATH);

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], queue);
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], queue);
      break;
    default:
      throw new Error(
        `Unknown inbound reply evidence comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
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
  const draft = buildInboundReplyEvidenceDraft({ issue, queue });
  console.log(renderInboundReplyEvidenceComment(draft));
}

export function renderInboundReplyEvidenceComment(draft) {
  const status = draft.readyToRecord
    ? 'Ready to record inbound lead evidence with the local operator command below.'
    : draft.findings.length === 0
      ? 'No lead record should be created from this reply.'
      : `Not ready to record. Findings: ${draft.findings.join('; ')}`;

  return [
    COMMENT_MARKER,
    '## SATA Inbound Reply Evidence Review',
    '',
    `Status: ${status}`,
    '',
    'No invoice, payment instruction, paid work, token grant, public post, compensation, or asset movement has been approved by this automation.',
    '',
    'Parsed evidence:',
    `- Source: ${safeValue(draft.intake.sourceType)} / ${safeValue(draft.intake.sourceId)}`,
    `- Contact: ${safeValue(draft.intake.contactHandle)}`,
    `- Project: ${safeValue(draft.intake.projectUrl)}`,
    `- Classification: ${safeValue(draft.triage?.classification ?? draft.intake.classification)}`,
    `- Customer asked for invoice: ${safeValue(String(draft.triage?.customerAskedForInvoice ?? draft.intake.customerAskedForInvoice))}`,
    `- Evidence: ${safeValue(draft.intake.replyEvidenceUrl || draft.issueUrl)}`,
    '',
    draft.triage?.replyTemplateText ? 'Suggested reply:' : null,
    draft.triage?.replyTemplateText ? '```text' : null,
    draft.triage?.replyTemplateText ?? null,
    draft.triage?.replyTemplateText ? '```' : null,
    '',
    draft.operatorCommand ? 'Operator command:' : 'Operator command not prepared:',
    draft.operatorCommand ? '```sh' : '- Fix findings first or do not record this reply as a lead.',
    draft.operatorCommand,
    draft.operatorCommand ? '```' : null,
    '',
    draft.triage?.nextCommandAfterRecord ? 'After record command:' : null,
    draft.triage?.nextCommandAfterRecord ? '```sh' : null,
    draft.triage?.nextCommandAfterRecord ?? null,
    draft.triage?.nextCommandAfterRecord ? '```' : null,
    '',
    `Next required action: ${draft.nextRequiredAction}`,
    '',
    'Boundaries:',
    '- Run any operator command only after confirming the issue evidence is durable and accurately preserves the reply.',
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
