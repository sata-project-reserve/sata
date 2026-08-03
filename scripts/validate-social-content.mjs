import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const queuePath = join('public', 'social-agent-content-queue.json');
const queue = JSON.parse(readFileSync(queuePath, 'utf8'));

const bannedPatterns = [
  /\bguaranteed (price|return|profit|upside|gain|yield)\b/i,
  /\brisk[- ]?free\b/i,
  /\bfully backed\b/i,
  /\bredeemable\b/i,
  /\bpump\b/i,
  /\braid\b/i,
  /\bmoon\b/i,
  /\b100x\b/i,
  /\bcan't lose\b/i,
  /\bcoordinated buy\b/i
];

const riskyTopics = [
  {
    pattern: /\bBTC\b|\bBitcoin\b|\breserve\b/i,
    caveat: /not a redemption promise|not a redemption path|not .*price target|not .*guaranteed price floor|not .*market-support/i
  },
  {
    pattern: /\bliquidity\b|\bLP\b|\bRaydium\b/i,
    caveat: /unlocked LP remains removable|locked .* verified|unlocked LP is disclosed|disclosed separately/i
  },
  {
    pattern: /\bGMGN\b/i,
    caveat: /manually verified|will be claimed only after/i
  }
];

const findings = [];

if (queue.mode !== 'draft-only-until-human-approval') {
  findings.push('queue.mode must remain draft-only-until-human-approval');
}

for (const post of queue.posts ?? []) {
  if (!post.id || !post.text) {
    findings.push('each post must include id and text');
    continue;
  }
  const textWithoutUrls = post.text.replaceAll(/https?:\/\/\S+/g, '');
  const promotionalText = textWithoutUrls.replaceAll(
    /not a redemption promise or guaranteed price floor|not (?:a )?(?:redemption promise|redemption path|guaranteed price floor|price target|market-support promise)/gi,
    ''
  );
  if (post.text.length > 280) {
    findings.push(`${post.id}: text exceeds 280 characters (${post.text.length})`);
  }
  for (const pattern of bannedPatterns) {
    if (pattern.test(promotionalText)) {
      findings.push(`${post.id}: matched banned wording ${pattern}`);
    }
  }
  for (const topic of riskyTopics) {
    if (topic.pattern.test(textWithoutUrls) && !topic.caveat.test(post.text)) {
      findings.push(`${post.id}: missing required caveat for ${topic.pattern}`);
    }
  }
  if (
    /https?:\/\/\S+/i.test(post.text) &&
    !/sata-project-reserve\.github\.io|github\.com\/sata-project-reserve\/sata|gmgn\.ai|dexscreener\.com|x\.com/i.test(
      post.text
    )
  ) {
    findings.push(`${post.id}: contains a non-approved URL`);
  }
}

if (findings.length > 0) {
  console.error('Social content check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Social content check passed: queued drafts follow SATA posting rules.');
