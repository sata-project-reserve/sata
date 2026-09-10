import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSocialPublishEvidenceDraft } from './lib/social-publish-evidence-parser.mjs';

const SOCIAL_QUEUE_PATH = join('public', 'social-agent-content-queue.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const socialQueue = await readJson(SOCIAL_QUEUE_PATH);

  switch (command) {
    case 'plan':
      console.log(
        JSON.stringify(
          {
            project: socialQueue.project,
            mode: 'social-publish-evidence-intake',
            issueTemplate: '.github/ISSUE_TEMPLATE/social-publish-evidence.yml',
            nextAction:
              'After an approved social post is published manually, submit the evidence issue and run the rendered record-published command only if the pasted text and approved SHA-256 match the queue.',
            boundary:
              'This intake does not publish posts, approve posts, contact anyone, issue invoices, grant tokens, or move assets.'
          },
          null,
          2
        )
      );
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], socialQueue);
      break;
    default:
      throw new Error(
        `Unknown social publish evidence command: ${command}. Use plan or draft-from-issue-json <path>.`
      );
  }
}

async function draftFromIssueJson(path, socialQueue) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildSocialPublishEvidenceDraft({ issue, socialQueue }), null, 2));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
