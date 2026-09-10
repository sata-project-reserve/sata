import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EVIDENCE_INTAKE_URL =
  'https://github.com/sata-project-reserve/sata/issues/new?template=social-publish-evidence.yml';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;
  const options = parseOptions(args);
  const [status, queue] = await Promise.all([
    readJson(join('public', 'revenue-cycle-status.json')),
    readJson(join('public', 'social-agent-content-queue.json'))
  ]);
  const brief = buildSocialDispatchBrief({
    status,
    queue,
    maxManualPosts: options.max ? Number(options.max) : undefined
  });

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(brief, null, 2));
      break;
    case 'markdown':
      console.log(renderSocialDispatchMarkdown(brief));
      break;
    case 'write':
      await writeSocialDispatchBrief(brief);
      break;
    default:
      throw new Error(
        `Unknown social dispatch brief command: ${command}. Use plan, json, markdown, or write.`
      );
  }
}

export function buildSocialDispatchBrief({
  status,
  queue,
  maxManualPosts = 5,
  generatedAtUtc = new Date().toISOString()
}) {
  if (!status) throw new Error('Missing revenue cycle status.');
  if (!queue) throw new Error('Missing social content queue.');
  if (!Number.isSafeInteger(maxManualPosts) || maxManualPosts < 1 || maxManualPosts > 20) {
    throw new Error('maxManualPosts must be an integer from 1 to 20.');
  }

  const posts = queue.posts ?? [];
  const approvedPosts = posts.filter((post) => post.status === 'approved');
  const readyManualPosts = approvedPosts.slice(0, maxManualPosts).map((post) => ({
    id: post.id,
    type: post.type,
    text: post.text,
    contentSha256: post.contentSha256,
    approvedBy: post.approvedBy ?? null,
    approvalRole: post.approvalRole ?? null,
    approvedAtUtc: post.approvedAtUtc ?? null,
    evidenceIssueUrl: EVIDENCE_INTAKE_URL,
    recordPublishedCommand: recordPublishedCommand({ queue, post }),
    publicationInstructions:
      'Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.',
    stopRule:
      'Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, or move assets.'
  }));

  return {
    project: status.project,
    mode: 'manual-social-dispatch-brief',
    generatedAtUtc,
    account: queue.account,
    queueMode: queue.mode,
    automationEnabled: false,
    livePostingEnabled: Boolean(status.social?.livePostingEnabled),
    maxManualPosts,
    counts: {
      approved: String(approvedPosts.length),
      readyForReview: String(posts.filter((post) => post.status === 'ready-for-review').length),
      published: String(posts.filter((post) => post.status === 'published').length),
      hold: String(posts.filter((post) => String(post.status).startsWith('hold')).length)
    },
    readyManualPostCount: approvedPosts.length,
    queuedRemainderCount: Math.max(approvedPosts.length - readyManualPosts.length, 0),
    readyManualPosts,
    evidenceIssueUrl: EVIDENCE_INTAKE_URL,
    nextAction: readyManualPosts[0]?.id
      ? `Publish approved post ${readyManualPosts[0].id} exactly as written, then record the live URL with evidence.`
      : posts.some((post) => post.status === 'ready-for-review')
        ? 'Chairman review is needed before the next social post can be published.'
        : status.nextAction,
    boundary:
      'This brief coordinates manual social dispatch only. It does not publish posts, approve posts, contact prospects, request payment, grant tokens, move assets, or record state.'
  };
}

export function renderSocialDispatchMarkdown(brief) {
  const lines = [
    `# ${brief.project} Social Dispatch Brief`,
    '',
    `Generated: ${brief.generatedAtUtc}`,
    `Account: @${brief.account.handle}`,
    '',
    '## Boundary',
    brief.boundary,
    '',
    '## Evidence Intake',
    brief.evidenceIssueUrl,
    '',
    '## Queue Counts',
    `Approved: ${brief.counts.approved}`,
    `Ready for review: ${brief.counts.readyForReview}`,
    `Published: ${brief.counts.published}`,
    `Hold: ${brief.counts.hold}`,
    `Live posting enabled: ${brief.livePostingEnabled}`,
    '',
    '## Ready Manual Posts',
    `Batch: ${brief.readyManualPosts.length} of ${brief.readyManualPostCount} approved posts. Backlog after this batch: ${brief.queuedRemainderCount}.`
  ];

  if (brief.readyManualPosts.length === 0) {
    lines.push('', 'No approved social posts are ready for manual publication.');
  }

  for (const post of brief.readyManualPosts) {
    lines.push(
      '',
      `### ${post.id}`,
      `Type: ${post.type}`,
      `Approved by: ${post.approvedBy ?? 'not recorded'}`,
      `Approval role: ${post.approvalRole ?? 'not recorded'}`,
      `Approved at: ${post.approvedAtUtc ?? 'not recorded'}`,
      `Approved content SHA-256: ${post.contentSha256}`,
      post.publicationInstructions,
      post.stopRule,
      '',
      '```text',
      post.text,
      '```',
      '',
      'After manual publication, record the live post evidence:',
      '',
      '```sh',
      post.recordPublishedCommand,
      '```'
    );
  }

  lines.push('', '## Next Action', brief.nextAction);
  return `${lines.join('\n')}\n`;
}

async function writeSocialDispatchBrief(brief) {
  const jsonPath = join('public', 'social-dispatch-brief.json');
  const markdownPath = join('public', 'social-dispatch-brief.md');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(brief, null, 2)}\n`),
    writeFile(markdownPath, renderSocialDispatchMarkdown(brief))
  ]);
  console.log(
    JSON.stringify(
      { wrote: [jsonPath, markdownPath], readyManualPosts: brief.readyManualPosts.length },
      null,
      2
    )
  );
}

function recordPublishedCommand({ queue, post }) {
  return [
    'npm run social:agent -- record-published',
    `--post ${post.id}`,
    `--postUrl "https://x.com/${queue.account.handle}/status/<numeric-id>"`,
    '--evidence "<live-post-screenshot-or-exported-text>"',
    '--publishedAtUtc "<published-at-utc>"',
    `--contentHash ${post.contentSha256}`
  ].join(' ');
}

function parseOptions(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    parsed[key] = next && !next.startsWith('--') ? next : true;
    if (parsed[key] === next) index += 1;
  }
  return parsed;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
