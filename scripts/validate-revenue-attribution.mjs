import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildRevenueAttributionPlan,
  renderRevenueAttributionMarkdown,
  validateRevenueAttributionPlan
} from './lib/revenue-attribution.mjs';

const status = await readJson(join('public', 'revenue-cycle-status.json'));
const paidPromotionLedger = await readJson(join('public', 'paid-promotion-ledger.json'));
const outreachPacketQueue = await readJson(join('public', 'service-outreach-packet-queue.json'));
const plan = buildRevenueAttributionPlan({
  status,
  paidPromotionLedger,
  outreachPacketQueue,
  maxManualSends: 5,
  generatedAtUtc: '2026-09-03T21:00:00.000Z'
});
const markdown = renderRevenueAttributionMarkdown(plan);
const findings = [];

try {
  validateRevenueAttributionPlan(plan);
} catch (error) {
  findings.push(error.message);
}

const diana = plan.paidCampaigns.find(
  (campaign) => campaign.campaignId === 'diana-crypto-20260903-transparency-tweet'
);
if (!diana) {
  findings.push('Diana paid campaign must be present in attribution plan');
} else {
  if (!diana.recommendedLinks.transparency.includes('utm_campaign=diana_crypto_20260903_transparency_tweet')) {
    findings.push('Diana transparency link must include a campaign UTM');
  }
  if (!/untracked unless X analytics or replies are recorded/i.test(diana.currentPostTracking)) {
    findings.push('Diana current post must be treated as untracked without analytics or replies');
  }
}

if (plan.outreachLinks.length !== 5) {
  findings.push('attribution plan must default to five manual outreach links');
}
if (!plan.outreachLinks[0]?.trackedServiceUrl.includes('utm_source=manual_outreach')) {
  findings.push('outreach service links must include manual_outreach source');
}
if (!markdown.includes('## Paid Campaign Links') || !markdown.includes('## Outreach Links')) {
  findings.push('markdown must include paid campaign and outreach link sections');
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)\b/i.test(markdown)) {
  findings.push('attribution markdown contains prohibited operating language');
}

if (findings.length > 0) {
  console.error('Revenue attribution check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Revenue attribution check passed: campaign links are tracked and measurement remains evidence-bound.');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
