import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReferralLeadEvidenceDraft } from './lib/referral-lead-evidence-parser.mjs';

const HANDOFF_QUEUE_PATH = join('public', 'referral-partner-handoff-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const handoffQueue = await readJson(HANDOFF_QUEUE_PATH);

  switch (command) {
    case 'plan':
      console.log(
        JSON.stringify(
          {
            project: handoffQueue.project,
            mode: 'referral-lead-evidence-intake',
            issueTemplate: '.github/ISSUE_TEMPLATE/referral-lead-evidence.yml',
            nextAction:
              'After an accepted referral handoff produces a customer referral, submit the evidence issue and run the rendered record-lead command only if the handoff is accepted-awaiting-referred-lead.',
            boundary:
              'This intake does not approve compensation, approve invoices, send payment instructions, grant tokens, publish posts, or move assets.'
          },
          null,
          2
        )
      );
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], handoffQueue);
      break;
    default:
      throw new Error(
        `Unknown referral lead evidence command: ${command}. Use plan or draft-from-issue-json <path>.`
      );
  }
}

async function draftFromIssueJson(path, handoffQueue) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildReferralLeadEvidenceDraft({ issue, handoffQueue }), null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
