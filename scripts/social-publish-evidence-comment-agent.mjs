import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSocialPublishEvidenceDraft } from './lib/social-publish-evidence-parser.mjs';

const SOCIAL_QUEUE_PATH = join('public', 'social-agent-content-queue.json');
const COMMENT_MARKER = '<!-- sata-social-publish-evidence-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const socialQueue = await readJson(SOCIAL_QUEUE_PATH);

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], socialQueue);
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], socialQueue);
      break;
    default:
      throw new Error(
        `Unknown social publish evidence comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
      );
  }
}

async function commentFromEventJson(path, socialQueue) {
  if (!path) throw new Error('Missing GitHub event JSON path.');
  const event = await readJson(path);
  if (!event.issue) throw new Error('GitHub event JSON does not include an issue payload.');
  printComment(event.issue, socialQueue);
}

async function commentFromIssueJson(path, socialQueue) {
  if (!path) throw new Error('Missing issue JSON path.');
  printComment(await readJson(path), socialQueue);
}

function printComment(issue, socialQueue) {
  const draft = buildSocialPublishEvidenceDraft({ issue, socialQueue });
  console.log(renderSocialPublishEvidenceComment(draft));
}

export function renderSocialPublishEvidenceComment(draft) {
  const status = draft.readyToRecord
    ? 'Ready to record social publication with the local operator command below.'
    : `Not ready to record. Findings: ${draft.findings.join('; ')}`;

  return [
    COMMENT_MARKER,
    '## SATA Social Publish Evidence Review',
    '',
    `Status: ${status}`,
    '',
    'No post, invoice, payment instruction, paid work, token grant, contact, or asset movement has been approved by this automation.',
    '',
    'Parsed evidence:',
    `- Post: ${safeValue(draft.intake.postId)}`,
    `- URL: ${safeValue(draft.intake.postUrl)}`,
    `- Evidence: ${safeValue(draft.intake.publicationEvidence || draft.issueUrl)}`,
    `- Approved content SHA-256: ${safeValue(draft.intake.approvedContentSha256)}`,
    `- Text matches approved post: ${draft.textMatchesApprovedPost}`,
    `- Hash matches approved post: ${draft.hashMatchesApprovedPost}`,
    '',
    draft.operatorCommand ? 'Operator command:' : 'Operator command not prepared:',
    draft.operatorCommand ? '```sh' : '- Fix findings first.',
    draft.operatorCommand,
    draft.operatorCommand ? '```' : null,
    '',
    `Next required action: ${draft.nextRequiredAction}`,
    '',
    'Boundaries:',
    '- Run the command only after confirming the post URL is live and the exact text matches the approved queue item.',
    '- Do not add price, return, buyer, liquidity, investment, market-support, or guaranteed-result claims.',
    '- Do not send invoices, payment instructions, token grants, or asset movements from this workflow.'
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
