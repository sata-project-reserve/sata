import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const QUEUE_PATH = join('public', 'social-agent-content-queue.json');
const MONITORING_PATH = join('public', 'social-agent-monitoring-log.json');
const REPORT_PATH = join('public', 'transparency', 'latest.json');
const PROFILE_PATH = join('public', 'social-agent-profile.json');
const X_POST_URL = 'https://api.x.com/2/tweets';
const POSTING_MODE = 'approved-only-automation';
const REVIEW_MODE = 'draft-only-until-human-approval';
const MAX_POSTS_PER_RUN = 1;

const [, , command = 'plan'] = process.argv;
const options = parseOptions(process.argv.slice(3));

const queue = await readJson(QUEUE_PATH);
const monitoring = await readJson(MONITORING_PATH);
const report = await readJson(REPORT_PATH);
const profile = await readJson(PROFILE_PATH);

switch (command) {
  case 'plan':
    printPlan();
    break;
  case 'draft-report-update':
    await draftReportUpdate();
    break;
  case 'approve-post':
    await approvePost();
    break;
  case 'reject-post':
    await rejectPost();
    break;
  case 'dry-run-post-next-approved':
    await postNextApproved({ dryRun: true });
    break;
  case 'post-next-approved':
    await postNextApproved({ dryRun: false });
    break;
  default:
    throw new Error(
      `Unknown x-social-agent command: ${command}. Use plan, draft-report-update, approve-post, reject-post, dry-run-post-next-approved, or post-next-approved.`
    );
}

function printPlan() {
  const approved = approvedPosts();
  const ready = (queue.posts ?? []).filter((post) => post.status === 'ready-for-review');
  const hold = (queue.posts ?? []).filter((post) => String(post.status).startsWith('hold'));
  console.log(
    JSON.stringify(
      {
        project: queue.project,
        account: queue.account,
        mode: queue.mode,
        automationEnabled: process.env.SATA_X_AGENT_ENABLE_POSTING === 'true',
        latestReport: {
          status: report.status,
          generatedAtUtc: report.generatedAtUtc,
          sourceCommit: report.source?.commit,
          sataReserveUi: report.liquidity?.sataReserveUi,
          wsolReserveUi: report.liquidity?.wsolReserveUi,
          lockedLpRaw: report.liquidity?.totalLockedLpRaw,
          ownerUnlockedLpRaw: report.liquidity?.ownerUnlockedLpRaw,
          btcReserveSats: report.bitcoinReserve?.reserveSats
        },
        counts: {
          approved: approved.length,
          readyForReview: ready.length,
          hold: hold.length,
          published: (queue.posts ?? []).filter((post) => post.status === 'published').length
        },
        nextAction:
          approved.length > 0
            ? `Next approved post: ${approved[0].id}`
            : 'No approved post. Drafts remain queued for human approval.'
      },
      null,
      2
    )
  );
}

async function draftReportUpdate() {
  const id = `transparency-${compactTimestamp(report.generatedAtUtc)}`;
  if ((queue.posts ?? []).some((post) => post.id === id)) {
    console.log(`Draft already exists: ${id}`);
    return;
  }

  const text = [
    'SATA transparency report updated.',
    '',
    `Reserve: ${report.bitcoinReserve.reserveSats} sats. Raydium LP lock status is publicly reported.`,
    '',
    'Not a redemption promise or guaranteed price floor. Locked LP verified; unlocked LP disclosed separately.',
    report.source.transparencyPage
  ].join('\n');

  queue.posts = [
    ...(queue.posts ?? []),
    {
      id,
      status: 'ready-for-review',
      type: 'transparency',
      text
    }
  ];
  await writeJson(QUEUE_PATH, queue);
  console.log(`Created ready-for-review draft: ${id}`);
}

async function approvePost() {
  const postId = cleanLine(options.post);
  const phrase = `I am Executive Chairman and approve social post ${postId}`;
  if (cleanLine(options.confirmChairmanApproval) !== phrase) {
    throw new Error(`Approval requires exact phrase: ${phrase}`);
  }
  const post = findPost(postId);
  if (post.status !== 'ready-for-review') {
    throw new Error(`${postId}: only ready-for-review posts can be approved.`);
  }
  validatePostForPublication({ ...post, status: 'approved', approvedBy: 'owner' });
  post.status = 'approved';
  post.approvedBy = 'owner';
  post.approvalRole = 'executive-chairman';
  post.approvedAtUtc = new Date().toISOString();
  await writeJson(QUEUE_PATH, queue);
  console.log(`Approved social post ${postId}.`);
}

async function rejectPost() {
  const postId = cleanLine(options.post);
  const phrase = `I am Executive Chairman and reject social post ${postId}`;
  if (cleanLine(options.confirmChairmanRejection) !== phrase) {
    throw new Error(`Rejection requires exact phrase: ${phrase}`);
  }
  const post = findPost(postId);
  if (post.status !== 'ready-for-review') {
    throw new Error(`${postId}: only ready-for-review posts can be rejected.`);
  }
  post.status = 'rejected';
  post.rejectedBy = 'owner';
  post.rejectionRole = 'executive-chairman';
  post.rejectedAtUtc = new Date().toISOString();
  post.rejectionReason = cleanLine(options.reason ?? 'not approved for publication');
  await writeJson(QUEUE_PATH, queue);
  console.log(`Rejected social post ${postId}.`);
}

async function postNextApproved({ dryRun }) {
  if (!assertPostingMode()) return;
  const posts = approvedPosts().slice(0, MAX_POSTS_PER_RUN);
  if (posts.length === 0) {
    console.log('No approved posts to publish.');
    return;
  }
  if (!dryRun && !assertLivePostingAllowed()) return;

  for (const post of posts) {
    validatePostForPublication(post);
    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            wouldPost: {
              id: post.id,
              text: post.text,
              paidPartnership: Boolean(post.paidPartnership)
            }
          },
          null,
          2
        )
      );
      continue;
    }

    const published = await createPost(post);
    markPublished(post, published.data.id);
    await writeJson(QUEUE_PATH, queue);
    await writeJson(MONITORING_PATH, monitoring);
    console.log(`Published ${post.id}: ${post.postUrl}`);
  }
}

function approvedPosts() {
  return (queue.posts ?? []).filter((post) => post.status === 'approved');
}

function findPost(postId) {
  if (!postId) throw new Error('Missing --post value.');
  const post = (queue.posts ?? []).find((item) => item.id === postId);
  if (!post) throw new Error(`Social post not found: ${postId}`);
  return post;
}

function assertPostingMode() {
  if (![POSTING_MODE, REVIEW_MODE].includes(queue.mode)) {
    throw new Error(`Unsupported queue mode: ${queue.mode}`);
  }
  if (queue.mode !== POSTING_MODE) {
    console.log(
      `Queue mode is ${queue.mode}. Set it to ${POSTING_MODE} only after enabling approved-only automation.`
    );
    return false;
  }
  return true;
}

function assertLivePostingAllowed() {
  if (process.env.SATA_X_AGENT_ENABLE_POSTING !== 'true') {
    console.log('Live posting is disabled. Set SATA_X_AGENT_ENABLE_POSTING=true to allow it.');
    return false;
  }
  if (!process.env.X_ACCESS_TOKEN) {
    throw new Error('Missing X_ACCESS_TOKEN OAuth user-context access token.');
  }
  return true;
}

function validatePostForPublication(post) {
  if (!post.id || !post.text) throw new Error('Approved posts require id and text.');
  if (post.text.length > 280) {
    throw new Error(`${post.id} exceeds 280 characters: ${post.text.length}`);
  }
  if (post.requiresHumanApproval && post.approvedBy !== 'owner') {
    throw new Error(`${post.id} requires approvedBy: "owner".`);
  }
  if (/treasury movement|liquidity removal|wallet migration|security incident/i.test(post.type)) {
    throw new Error(`${post.id} is escalation-only and cannot be auto-posted.`);
  }
}

async function createPost(post) {
  const response = await fetch(X_POST_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.X_ACCESS_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      text: post.text,
      paid_partnership: Boolean(post.paidPartnership)
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`X create post failed (${response.status}): ${JSON.stringify(body)}`);
  }
  if (!body?.data?.id) {
    throw new Error(`X create post response did not include a post id: ${JSON.stringify(body)}`);
  }
  return body;
}

function markPublished(post, postId) {
  const publishedAtUtc = new Date().toISOString();
  post.status = 'published';
  post.publishedAtUtc = publishedAtUtc;
  post.postUrl = `https://x.com/${queue.account.handle}/status/${postId}`;
  monitoring.posts ??= [];
  monitoring.posts.push({
    id: post.id,
    type: post.type,
    status: 'published',
    publishedAtUtc,
    postUrl: post.postUrl,
    source: 'x-social-agent',
    observations: []
  });
}

function compactTimestamp(value) {
  return String(value).replaceAll(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) continue;
    const collected = [];
    while (values[index + 1] && !values[index + 1].startsWith('--')) {
      collected.push(values[index + 1]);
      index += 1;
    }
    if (collected.length === 0) throw new Error(`Missing value for ${key}.`);
    parsed[key.slice(2)] = collected.join(' ');
  }
  return parsed;
}

function cleanLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
