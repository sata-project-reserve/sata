import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildRevenueExecutionBrief,
  renderRevenueExecutionMarkdown,
  validateRevenueExecutionBrief
} from './lib/revenue-execution-brief.mjs';

const status = await readJson(join('public', 'revenue-cycle-status.json'));
const paidPromotionLedger = await readJson(join('public', 'paid-promotion-ledger.json'));
const outreachPacketQueue = await readJson(join('public', 'service-outreach-packet-queue.json'));
const brief = buildRevenueExecutionBrief({
  status,
  paidPromotionLedger,
  outreachPacketQueue,
  maxManualSends: 5,
  generatedAtUtc: '2026-09-03T20:00:00.000Z'
});
const markdown = renderRevenueExecutionMarkdown(brief);
const findings = [];

try {
  validateRevenueExecutionBrief(brief);
} catch (error) {
  findings.push(error.message);
}

if (brief.topActions[0]?.type !== 'paid-promotion-verification') {
  findings.push('paid promotion verification must be the first top action while a campaign is unverified');
}
if (!brief.topActions[0]?.command?.includes('record-live --campaign diana-crypto-20260903-transparency-tweet')) {
  findings.push('first top action must expose the exact paid-promotion live evidence command');
}
if (brief.manualSendBatch.length !== 5) {
  findings.push('manual send batch must default to the first five ready outreach packets');
}
if (!brief.topActions.some((action) => action.type === 'manual-outreach-send')) {
  findings.push('brief must include manual outreach sends after paid-promotion verification');
}
if (!markdown.includes('## Top Actions') || !markdown.includes('## Stop Rules')) {
  findings.push('markdown must include top actions and stop rules');
}
if (!markdown.includes('No autonomous transactions')) {
  findings.push('markdown must include the autonomous-transaction stop rule');
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)\b/i.test(markdown)) {
  findings.push('brief markdown contains prohibited operating language');
}

const maintenanceBrief = buildRevenueExecutionBrief({
  status: {
    ...status,
    nextAction: 'Continue qualifying evidence-backed prospects.',
    funnel: {
      ...status.funnel,
      readyOutreachPackets: 0,
      paidPromotionCampaigns: 0,
      paidPromotionsAwaitingVerification: 0
    }
  },
  paidPromotionLedger: {
    ...paidPromotionLedger,
    campaigns: []
  },
  outreachPacketQueue: {
    ...outreachPacketQueue,
    packets: []
  },
  generatedAtUtc: '2026-09-03T20:00:00.000Z'
});
if (maintenanceBrief.topActions[0]?.type !== 'revenue-cycle-maintenance') {
  findings.push('empty execution inputs must still produce a maintenance action');
}

assertRejects('stale paid promotion count', /paid promotion campaign count must match/i, () =>
  buildRevenueExecutionBrief({
    status: {
      ...status,
      funnel: {
        ...status.funnel,
        paidPromotionCampaigns: 0
      }
    },
    paidPromotionLedger,
    outreachPacketQueue,
    generatedAtUtc: '2026-09-03T20:00:00.000Z'
  })
);

if (findings.length > 0) {
  console.error('Revenue execution brief check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Revenue execution brief check passed: top actions are measurable, bounded, and sats-oriented.');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function assertRejects(name, expected, fn) {
  try {
    fn();
  } catch (error) {
    if (!expected.test(error.message)) {
      throw new Error(`${name}: expected ${expected}, received ${error.message}`);
    }
    return;
  }
  throw new Error(`${name}: expected rejection.`);
}
