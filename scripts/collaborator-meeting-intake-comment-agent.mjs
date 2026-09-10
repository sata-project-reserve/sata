import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCollaboratorMeetingIntakeDraft } from './lib/collaborator-meeting-intake-parser.mjs';

const POLICY_PATH = join('public', 'collaborator-meeting-intake.json');
const COMMENT_MARKER = '<!-- sata-collaborator-meeting-intake-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const policy = await readJson(POLICY_PATH);
  const context = { policy };

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], context);
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], context);
      break;
    default:
      throw new Error(
        `Unknown collaborator meeting intake comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
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
  const draft = buildCollaboratorMeetingIntakeDraft({ issue, ...context });
  console.log(renderCollaboratorMeetingIntakeComment(draft));
}

export function renderCollaboratorMeetingIntakeComment(draft) {
  const status = draft.readyForChairmanReview
    ? 'Ready for chairman review. No execution command has been prepared.'
    : `Not ready for chairman review. Findings: ${draft.findings.join('; ')}`;

  return [
    COMMENT_MARKER,
    '## SATA Collaborator Meeting Intake Review',
    '',
    `Status: ${status}`,
    '',
    'No meeting, partnership, compensation, invoice, payment instruction, token grant, post, custody change, or asset movement has been approved by this automation.',
    '',
    'Parsed submission:',
    `- Collaborator: ${safeValue(draft.intake.collaboratorName)}`,
    `- Profile: ${safeValue(draft.intake.publicProfileUrl)}`,
    `- Proposed role: ${safeValue(draft.intake.proposedRole)}`,
    `- Dubai meeting: ${safeValue(draft.intake.willingToMeetDubai)}`,
    `- Policy status: ${safeValue(draft.policyStatus)}`,
    `- Ready for scheduling: ${draft.readyForScheduling}`,
    '',
    'Recommended next steps:',
    ...draft.recommendedNextSteps.map((step) => `- ${step}`),
    '',
    'Boundary:',
    draft.boundary,
    '',
    'Controls:',
    '- Use this only as evidence for Executive Chairman review.',
    '- Any meeting must be separately approved and public-place only.',
    '- No price, buyer, return, liquidity, volume, market-support, fake-engagement, bot, raid, custody, or payment claims.'
  ].join('\n');
}

function safeValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || 'Not provided';
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
