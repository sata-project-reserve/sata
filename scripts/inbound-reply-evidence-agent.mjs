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
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], queue);
      break;
    default:
      throw new Error(
        `Unknown inbound reply evidence command: ${command}. Use plan or draft-from-issue-json <path>.`
      );
  }
}

async function draftFromIssueJson(path, queue) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildInboundReplyEvidenceDraft({ issue, queue }), null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
