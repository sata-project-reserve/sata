import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSocialDispatchBrief,
  renderSocialDispatchMarkdown
} from './social-dispatch-brief-agent.mjs';

const status = readJson(join('public', 'revenue-cycle-status.json'));
const queue = readJson(join('public', 'social-agent-content-queue.json'));
const publicBrief = readOptionalJson(join('public', 'social-dispatch-brief.json'));
const publicMarkdown = readOptionalText(join('public', 'social-dispatch-brief.md'));
const agent = readFileSync(join('scripts', 'social-dispatch-brief-agent.mjs'), 'utf8');
const packageJson = readJson('package.json');
const brief = buildSocialDispatchBrief({
  status,
  queue,
  generatedAtUtc: publicBrief?.generatedAtUtc ?? '2026-09-10T17:00:00.000Z'
});
const markdown = renderSocialDispatchMarkdown(brief);
const findings = [];

if (brief.mode !== 'manual-social-dispatch-brief') {
  findings.push('brief mode must be manual-social-dispatch-brief');
}
if (!/does not publish posts/i.test(brief.boundary ?? '')) {
  findings.push('boundary must say the brief does not publish posts');
}
if (!/move assets/i.test(brief.boundary ?? '')) {
  findings.push('boundary must prohibit asset movement');
}
if (brief.automationEnabled !== false) {
  findings.push('social dispatch brief must not enable automation');
}
if (brief.readyManualPostCount !== Number(brief.counts.approved)) {
  findings.push('ready manual post count must match approved social post count');
}
if (brief.readyManualPosts.length !== Math.min(brief.readyManualPostCount, brief.maxManualPosts)) {
  findings.push('ready manual posts must expose only the bounded batch');
}
if (
  brief.queuedRemainderCount !==
  Math.max(brief.readyManualPostCount - brief.readyManualPosts.length, 0)
) {
  findings.push('queued remainder count must match approved backlog minus batch size');
}
if (!/social-publish-evidence\.yml/.test(brief.evidenceIssueUrl ?? '')) {
  findings.push('brief must expose the social publish evidence issue form');
}
for (const post of brief.readyManualPosts) {
  if (!/^[a-f0-9]{64}$/.test(post.contentSha256 ?? '')) {
    findings.push(`${post.id}: approved content SHA-256 must be exposed`);
  }
  if (!post.recordPublishedCommand?.includes(`--contentHash ${post.contentSha256}`)) {
    findings.push(`${post.id}: record command must include the approved content hash`);
  }
  if (!post.recordPublishedCommand?.includes('--publishedAtUtc "<published-at-utc>"')) {
    findings.push(`${post.id}: record command must require explicit publishedAtUtc evidence`);
  }
  if (!post.recordPublishedCommand?.includes(`https://x.com/${queue.account.handle}/status/<numeric-id>`)) {
    findings.push(`${post.id}: record command must require the canonical account status URL`);
  }
  if (!/(do not edit|exact approved text)/i.test(post.stopRule ?? post.publicationInstructions ?? '')) {
    findings.push(`${post.id}: stop rule must require exact approved text`);
  }
}
if (!markdown.includes('## Ready Manual Posts')) {
  findings.push('markdown must include ready manual posts section');
}
if (!markdown.includes('Approved content SHA-256')) {
  findings.push('markdown must expose approved content SHA-256');
}
if (!markdown.includes('record-published')) {
  findings.push('markdown must expose manual record-published commands');
}
if (!markdown.includes('social-publish-evidence.yml')) {
  findings.push('markdown must link social publish evidence intake');
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|pump|moon|100x)\b/i.test(markdown)) {
  findings.push('dispatch markdown must not include prohibited or secret-requesting language');
}
if (/post-next-approved|createPost|api\.x\.com|SATA_X_BEARER_TOKEN|SATA_X_ACCESS_TOKEN/.test(agent)) {
  findings.push('dispatch agent must not import or execute live X posting capability');
}
if (packageJson.scripts?.['ops:social-dispatch-check'] !== 'node scripts/validate-social-dispatch-brief.mjs') {
  findings.push('package.json must expose ops:social-dispatch-check');
}
if (packageJson.scripts?.['ops:social-dispatch-write'] !== 'node scripts/social-dispatch-brief-agent.mjs write') {
  findings.push('package.json must expose ops:social-dispatch-write');
}
if (publicBrief) {
  const expectedPublicBrief = buildSocialDispatchBrief({
    status,
    queue,
    maxManualPosts: publicBrief.maxManualPosts,
    generatedAtUtc: publicBrief.generatedAtUtc
  });
  if (JSON.stringify(publicBrief) !== JSON.stringify(expectedPublicBrief)) {
    findings.push('public social-dispatch-brief.json must match current generated brief');
  }
  if (
    publicMarkdown &&
    normalizeMarkdown(publicMarkdown) !== normalizeMarkdown(renderSocialDispatchMarkdown(publicBrief))
  ) {
    findings.push('public social-dispatch-brief.md must match public JSON brief');
  }
}
if (publicMarkdown && !publicBrief) {
  findings.push('public social-dispatch-brief.md requires matching JSON');
}

if (findings.length > 0) {
  console.error('Social dispatch brief check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Social dispatch brief check passed: approved posts are copy-ready and hash-bound.');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function readOptionalText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function normalizeMarkdown(value) {
  return String(value ?? '').replace(/\r\n/g, '\n');
}
