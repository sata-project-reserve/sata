import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAuditIntakeDraft } from './lib/audit-intake-parser.mjs';

const DELIVERY_KIT_PATH = join('public', 'transparency-audit-delivery-kit.json');
const PROSPECT_PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const INVOICE_QUEUE_PATH = join('public', 'sats-invoice-queue.json');
const COMMENT_MARKER = '<!-- sata-audit-intake-review -->';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'comment-from-event-json', ...args] = process.argv;
  const [deliveryKit, prospectPipeline, invoiceQueue] = await Promise.all([
    readJson(DELIVERY_KIT_PATH),
    readJson(PROSPECT_PIPELINE_PATH),
    readJson(INVOICE_QUEUE_PATH)
  ]);

  switch (command) {
    case 'comment-from-event-json':
      await commentFromEventJson(args[0], { deliveryKit, prospectPipeline, invoiceQueue });
      break;
    case 'comment-from-issue-json':
      await commentFromIssueJson(args[0], { deliveryKit, prospectPipeline, invoiceQueue });
      break;
    default:
      throw new Error(
        `Unknown audit-intake comment command: ${command}. Use comment-from-event-json <path> or comment-from-issue-json <path>.`
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
  const { deliveryKit, prospectPipeline, invoiceQueue } = context;
  const draft = buildAuditIntakeDraft({ issue, deliveryKit, prospectPipeline, invoiceQueue });
  console.log(renderAuditIntakeComment(draft));
}

export function renderAuditIntakeComment(draft) {
  const missing = draft.missingRequiredFields;
  const status =
    missing.length > 0
      ? `Incomplete intake. Missing: ${missing.map(formatFieldName).join(', ')}.`
      : 'Complete intake parsed for Executive Chairman review.';

  return [
    COMMENT_MARKER,
    '## SATA Transparency Audit Intake Review',
    '',
    `Status: ${status}`,
    '',
    'No payment instruction has been issued by this automation.',
    '',
    'Parsed scope:',
    `- Project: ${safeValue(draft.intake.projectName)}`,
    `- Network: ${safeValue(draft.intake.network)}`,
    `- Public project: ${safeValue(draft.intake.publicProjectUrl)}`,
    `- Public profile: ${safeValue(draft.intake.publicProfileUrl)}`,
    `- Claims requested: ${safeValue(draft.intake.claimsToReview)}`,
    `- Requested visibility: ${safeValue(draft.intake.requestedDeliverableVisibility)}`,
    `- Payment status: ${safeValue(draft.intake.paymentStatus)}`,
    '',
    'Draft records prepared:',
    `- Prospect draft id: ${draft.prospectDraft.id}`,
    `- Offer: ${draft.invoiceDraft.offerId} ($${draft.invoiceDraft.usdPrice})`,
    `- Delivery draft: ${draft.deliveryDraft.title}`,
    '',
    `Next required action: ${draft.nextRequiredAction}`,
    '',
    'Boundaries:',
    '- Executive Chairman approval is required before any invoice, payment request, paid work, token grant, or public commitment.',
    '- SATA does not provide price promotion, market-making, investor targeting, fake engagement, bots, raids, legal advice, tax advice, or investment advice.'
  ].join('\n');
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
