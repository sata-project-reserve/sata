import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralHandoffResponseEvidenceDraft } from './lib/referral-handoff-response-evidence-parser.mjs';

const QUEUE_PATH = join('public', 'referral-partner-handoff-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const queue = await readJson(QUEUE_PATH);

  switch (command) {
    case 'plan':
      console.log(
        JSON.stringify(
          {
            project: queue.project,
            mode: 'referral-handoff-response-evidence-intake',
            issueTemplate: '.github/ISSUE_TEMPLATE/referral-handoff-response-evidence.yml',
            nextAction:
              'After a recorded referral handoff receives a partner response, submit the evidence issue and run the rendered record-response command only if the handoff is sent-awaiting-response.',
            boundary:
              'This intake does not approve compensation, approve invoices, send payment instructions, grant tokens, publish posts, or move assets.'
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
        `Unknown referral handoff response evidence command: ${command}. Use plan or draft-from-issue-json <path>.`
      );
  }
}

async function draftFromIssueJson(path, queue) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildReferralHandoffResponseEvidenceDraft({ issue, queue }), null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
