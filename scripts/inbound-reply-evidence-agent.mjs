import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildInboundReplyEvidenceDraft } from './lib/inbound-reply-evidence-parser.mjs';

const INBOUND_QUEUE_PATH = join('public', 'inbound-service-lead-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const queue = await readJson(INBOUND_QUEUE_PATH);

  switch (command) {
    case 'plan':
      console.log(
        JSON.stringify(
          {
            project: queue.project,
            mode: 'inbound-reply-evidence-intake',
            issueTemplate: '.github/ISSUE_TEMPLATE/inbound-reply-evidence.yml',
            templateCommand:
              'node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType "<source-type>" --sourceId "<source-id>" --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "<classification>" --customerAskedForInvoice false',
            nextAction:
              'When a reply or DM arrives, submit the inbound reply evidence issue and run the rendered operator command only if the review marks the reply ready to record.',
            boundary:
              'This intake does not contact leads, approve invoices, send payment instructions, grant tokens, publish posts, approve compensation, or move assets.'
          },
          null,
          2
        )
      );
      break;
    case 'render-template':
      printIssueTemplate(args);
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], queue);
      break;
    default:
      throw new Error(
        `Unknown inbound reply evidence command: ${command}. Use plan, render-template, or draft-from-issue-json <path>.`
      );
  }
}

function printIssueTemplate(args) {
  const options = parseOptions(args);
  console.log(
    renderInboundReplyEvidenceIssueBody({
      sourceType: options.sourceType,
      sourceId: options.sourceId,
      contactHandle: options.contactHandle,
      publicProfileUrl: options.publicProfileUrl,
      projectUrl: options.projectUrl,
      requestedOfferId: options.offer ?? options.requestedOfferId,
      exactReplyText: options.replyText,
      replyEvidenceUrl: options.evidence,
      recordedAtUtc: options.recordedAtUtc,
      classification: options.classification,
      customerAskedForInvoice: options.customerAskedForInvoice
    })
  );
}

export function renderInboundReplyEvidenceIssueBody({
  sourceType = '<source-type>',
  sourceId = '<source-id>',
  contactHandle = '<x-handle-or-contact>',
  publicProfileUrl = '<https-profile-url>',
  projectUrl = '<https-project-url>',
  requestedOfferId = 'transparency-audit',
  exactReplyText = '<reply-or-dm-text>',
  replyEvidenceUrl = '<reply-or-dm-evidence>',
  recordedAtUtc = '<recorded-at-utc>',
  classification = '<classification>',
  customerAskedForInvoice = false
}) {
  return [
    '### Source type',
    cleanLine(sourceType),
    '',
    '### Source ID',
    cleanLine(sourceId),
    '',
    '### Contact handle',
    cleanLine(contactHandle),
    '',
    '### Public profile URL',
    cleanLine(publicProfileUrl),
    '',
    '### Project URL',
    cleanLine(projectUrl),
    '',
    '### Requested offer ID',
    cleanLine(requestedOfferId),
    '',
    '### Exact reply text',
    String(exactReplyText ?? '').replace(/\r/g, '').trim(),
    '',
    '### Reply evidence URL or reference',
    cleanLine(replyEvidenceUrl),
    '',
    '### Recorded at UTC',
    cleanLine(recordedAtUtc),
    '',
    '### Classification',
    cleanLine(classification),
    '',
    '### Customer asked for invoice',
    String(customerAskedForInvoice).toLowerCase() === 'true' ? 'true' : 'false'
  ].join('\n');
}

async function draftFromIssueJson(path, queue) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildInboundReplyEvidenceDraft({ issue, queue }), null, 2));
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
