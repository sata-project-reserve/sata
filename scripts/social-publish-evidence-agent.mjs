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
            renderEvidenceIssueTemplateCommand:
              'node scripts/social-publish-evidence-agent.mjs render-template --post "<approved-post-id>" --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash "<approved-content-sha256>"',
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
    case 'render-template':
      printIssueTemplate(args, socialQueue);
      break;
    case 'draft-from-issue-json':
      await draftFromIssueJson(args[0], socialQueue);
      break;
    default:
      throw new Error(
        `Unknown social publish evidence command: ${command}. Use plan, render-template, or draft-from-issue-json <path>.`
      );
  }
}

function printIssueTemplate(args, socialQueue) {
  const options = parseOptions(args);
  const postId = options.post ?? options.postId;
  if (!postId) throw new Error('Missing approved social post id.');
  const post = (socialQueue.posts ?? []).find((item) => item.id === postId);
  if (!post) throw new Error(`Approved social post not found: ${postId}.`);
  if (post.status !== 'approved') {
    throw new Error(`${postId}: social publish evidence templates require an approved post.`);
  }
  if (options.contentHash && options.contentHash !== post.contentSha256) {
    throw new Error(`${postId}: contentHash does not match the approved social queue post.`);
  }
  console.log(
    renderSocialPublishEvidenceIssueBody({
      postId: post.id,
      postUrl: options.postUrl ?? `https://x.com/${socialQueue.account?.handle}/status/<numeric-id>`,
      publicationEvidence: options.evidence ?? '<live-post-screenshot-or-exported-text>',
      approvedContentSha256: post.contentSha256,
      exactPostText: post.text,
      publishedAtUtc: options.publishedAtUtc ?? '<published-at-utc>'
    })
  );
}

export function renderSocialPublishEvidenceIssueBody({
  postId = '<approved-post-id>',
  postUrl = 'https://x.com/SATAReserve/status/<numeric-id>',
  publicationEvidence = '<live-post-screenshot-or-exported-text>',
  approvedContentSha256 = '<approved-content-sha256>',
  exactPostText = '<exact-approved-post-text>',
  publishedAtUtc = '<published-at-utc>'
} = {}) {
  return [
    '### Social post ID',
    cleanLine(postId),
    '',
    '### Published post URL',
    cleanLine(postUrl),
    '',
    '### Publication evidence URL or reference',
    cleanLine(publicationEvidence),
    '',
    '### Approved content SHA-256',
    cleanLine(approvedContentSha256),
    '',
    '### Exact post text published',
    String(exactPostText ?? '').replace(/\r/g, '').trim(),
    '',
    '### Published at UTC',
    cleanLine(publishedAtUtc)
  ].join('\n');
}

async function draftFromIssueJson(path, socialQueue) {
  if (!path) throw new Error('Missing issue JSON path.');
  const issue = await readJson(path);
  console.log(JSON.stringify(buildSocialPublishEvidenceDraft({ issue, socialQueue }), null, 2));
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
