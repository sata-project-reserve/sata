import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildSatsTargetPlan,
  renderSatsTargetMarkdown,
  validateSatsTargetPlan
} from './lib/sats-target-planner.mjs';

const status = await readJson(join('public', 'revenue-cycle-status.json'));
const revenuePlan = await readJson(join('public', 'revenue-operating-plan.json'));
const satsLedger = await readJson(join('public', 'sats-generation-ledger.json'));
const plan = buildSatsTargetPlan({
  status,
  revenuePlan,
  satsLedger,
  btcUsd: 100000,
  generatedAtUtc: '2026-09-03T22:00:00.000Z'
});
const markdown = renderSatsTargetMarkdown(plan);
const findings = [];

try {
  validateSatsTargetPlan(plan);
} catch (error) {
  findings.push(error.message);
}

if (plan.target.remainingSats !== status.currentReserve.remainingSats) {
  findings.push('target remaining sats must match revenue cycle status');
}
if (plan.milestones[0]?.additionalSats !== '500000') {
  findings.push('next milestone must require 500000 additional sats');
}
const starter = plan.scenarios.find((scenario) => scenario.offerId === 'transparency-audit');
if (!starter) {
  findings.push('starter transparency-audit scenario is required');
} else {
  if (starter.estimatedReserveSatsPerDeal !== '35000') {
    findings.push('starter audit should add 35000 planning sats at $100k BTC and 70% allocation');
  }
  if (starter.dealsToNextMilestone !== 15) {
    findings.push('starter audit should require 15 deals to reach the next 1M sats milestone');
  }
  if (starter.dealsToFullTarget <= 1000) {
    findings.push('full target must show starter-audit volume is not enough alone');
  }
}
if (!markdown.includes('BTC/USD assumption: 100000')) {
  findings.push('markdown must include the BTC/USD planning assumption');
}
if (!markdown.includes('full target requires higher-value setup/dashboard work')) {
  findings.push('markdown must include the operating read about higher-value work');
}
if (/\b(private key|seed phrase|guaranteed buyers|fake engagement|bots|raids|price prediction|price guarantee|redemption promise)\b/i.test(markdown)) {
  findings.push('target planner markdown contains prohibited operating language');
}

if (findings.length > 0) {
  console.error('Sats target planner check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats target planner check passed: reserve goal math is explicit and gated.');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
