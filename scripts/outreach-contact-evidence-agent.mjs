import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOutreachContactEvidenceDraft } from './lib/outreach-contact-evidence-parser.mjs';

const PIPELINE_PATH = join('public', 'sats-prospect-pipeline.json');
const OUTREACH_PACKET_QUEUE_PATH = join('public', 'service-outreach-packet-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const [pipeline, packetQueue] = await Promise.all([
    readJson(PIPELINE_PATH),
    readJson(OUTREACH_PACKET_QUEUE_PATH)
  ]);

  switch (command) {
    case 'plan':
      printPlan();
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], { pipeline, packetQueue });
      break;
    default:
      throw new Error(
        `Unknown outreach contact evidence command: ${command}. Use plan or draft-from-issue-json <path>.`
      );
  }
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        project: 'SATA Reserve Token',
        mode: 'outreach-contact-evidence-intake',
        issueTemplate: '.github/ISSUE_TEMPLATE/outreach-contact-evidence.yml',
        requiredFields: [
          'packetId',
          'prospectId',
          'contactChannel',
          'contactEvidenceUrl',
          'approvedMessageSha256',
          'exactMessageSent'
        ],
        nextOperatingAction:
          'After a human sends approved outreach, submit the contact evidence issue and run the rendered mark-sent command only if the pasted message and approved SHA-256 match the packet.',
        boundary:
          'This agent parses evidence only. It does not contact prospects, approve invoices, send payment instructions, publish posts, grant tokens, or move assets.'
      },
      null,
      2
    )
  );
}

async function draftFromIssueJson(path, context) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildOutreachContactEvidenceDraft({ issue, ...context }), null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
