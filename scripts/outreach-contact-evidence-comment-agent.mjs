import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOutreachContactEvidenceDraft } from './lib/outreach-contact-evidence-parser.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const OUTREACH_PACKET_QUEUE_PATH = join('public', 'service-outreach-packet-queue.json');
const COMMENT_MARKER = '<!-- sata-outreach-contact-evidence-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const [pipeline, packetQueue] = await Promise.all([
    readJson(PIPELINE_PATH),
    readJson(OUTREACH_PACKET_QUEUE_PATH)
  ]);
  const context = { pipeline, packetQueue };

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], context);
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], context);
      break;
    default:
      throw new Error(
        `Unknown outreach contact evidence comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
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
  const draft = buildOutreachContactEvidenceDraft({ issue, ...context });
  console.log(renderOutreachContactEvidenceComment(draft));
}

export function renderOutreachContactEvidenceComment(draft) {
  const status = draft.readyToRecord
    ? 'Ready to record contact evidence with the local operator command below.'
    : `Not ready to record. Findings: ${draft.findings.join('; ')}`;

  return [
    COMMENT_MARKER,
    '## SATA Outreach Contact Evidence Review',
    '',
    `Status: ${status}`,
    '',
    'No outreach, invoice, payment instruction, paid work, token grant, public post, or asset movement has been approved by this automation.',
    '',
    'Parsed evidence:',
    `- Packet: ${safeValue(draft.intake.packetId)}`,
    `- Prospect: ${safeValue(draft.intake.prospectId)}`,
    `- Channel: ${safeValue(draft.intake.contactChannel)}`,
    `- Evidence: ${safeValue(draft.intake.contactEvidenceUrl || draft.issueUrl)}`,
    `- Approved message SHA-256: ${safeValue(draft.intake.approvedMessageSha256)}`,
    `- Message matches approved packet: ${draft.messageMatchesApprovedPacket}`,
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
    '- Run the command only after confirming the issue evidence is durable and the message was actually sent.',
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
