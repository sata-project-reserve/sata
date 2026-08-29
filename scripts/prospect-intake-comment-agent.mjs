import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildProspectIntakeDraft } from './lib/prospect-intake-parser.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const COMMENT_MARKER = '<!-- sata-prospect-intake-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const pipeline = await readJson(PIPELINE_PATH);

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], { pipeline });
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], { pipeline });
      break;
    default:
      throw new Error(
        `Unknown prospect-intake comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
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
  const draft = buildProspectIntakeDraft({ issue, pipeline: context.pipeline });
  console.log(renderProspectIntakeComment(draft));
}

export function renderProspectIntakeComment(draft) {
  const missing = draft.missingRequiredFields;
  const status =
    missing.length > 0
      ? `Incomplete prospect intake. Missing: ${missing.map(formatFieldName).join(', ')}.`
      : 'Complete prospect candidate parsed for Executive Chairman review.';
  const prospectDraft = draft.prospectDraft;

  return [
    COMMENT_MARKER,
    '## SATA Prospect Candidate Review',
    '',
    `Status: ${status}`,
    '',
    'No outreach, invoice, payment request, token grant, or public commitment has been approved by this automation.',
    '',
    'Parsed candidate:',
    `- Prospect: ${safeValue(draft.intake.prospectName)}`,
    `- Public profile: ${safeValue(draft.intake.publicProfileUrl)}`,
    `- Project URL: ${safeValue(draft.intake.projectUrl)}`,
    `- Observed claim or evidence gap: ${safeValue(draft.intake.observedClaim)}`,
    `- Recommended offer: ${safeValue(draft.intake.recommendedOffer)}`,
    '',
    prospectDraft ? 'Draft record prepared:' : 'Draft record not prepared:',
    prospectDraft ? `- Prospect draft id: ${prospectDraft.id}` : '- Missing required fields.',
    prospectDraft ? `- Stage: ${prospectDraft.stage}` : null,
    prospectDraft ? `- Chairman approved before outreach: ${prospectDraft.chairmanApprovedBeforeOutreach}` : null,
    '',
    `Next required action: ${draft.nextRequiredAction}`,
    '',
    'Boundaries:',
    '- Executive Chairman approval is required before any contact, invoice, payment request, paid work, token grant, or public commitment.',
    '- SATA does not provide price promotion, market-making, investor targeting, fake engagement, bots, raids, legal advice, tax advice, or investment advice.'
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function formatFieldName(field) {
  return String(field)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}

function safeValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || 'Not provided';
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
