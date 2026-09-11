import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSatsTargetPlan,
  renderSatsTargetMarkdown,
  validateSatsTargetPlan
} from './lib/sats-target-planner.mjs';

const status = await readJson(join('public', 'revenue-cycle-status.json'));
const revenuePlan = await readJson(join('public', 'revenue-operating-plan.json'));
const satsLedger = await readJson(join('public', 'sats-generation-ledger.json'));
const packageJson = await readJson('package.json');
const targetAgent = readFileSync(join('scripts', 'sats-target-agent.mjs'), 'utf8');
const transparencyWorkflow = readFileSync(
  join('.github', 'workflows', 'transparency-report.yml'),
  'utf8'
);
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
if (!plan.currentPipeline) {
  findings.push('target planner must include current pipeline coverage');
} else {
  if (plan.currentPipeline.manualOutreachActions !== 30) {
    findings.push('current pipeline must count 30 ready manual outreach actions');
  }
  if (plan.currentPipeline.qualifiedRevenueUsd !== '2300.00') {
    findings.push('current pipeline qualified revenue should total $2300 from ready manual outreach');
  }
  if (plan.currentPipeline.estimatedReserveSatsAtFullClose !== '1610000') {
    findings.push('current pipeline should estimate 1610000 reserve sats at full close');
  }
  if (plan.currentPipeline.gapToNextMilestoneSatsAtFullClose !== '0') {
    findings.push('current pipeline should cover the next 1M sats milestone at full close');
  }
  if (!/planning only/i.test(plan.assumptions.actualSatsRule)) {
    findings.push('current pipeline math must remain planning-only');
  }
}
if (!markdown.includes('BTC/USD assumption: 100000')) {
  findings.push('markdown must include the BTC/USD planning assumption');
}
if (!markdown.includes('## Current Outreach Coverage')) {
  findings.push('markdown must include current outreach coverage');
}
if (!markdown.includes('full target requires higher-value setup/dashboard work')) {
  findings.push('markdown must include the operating read about higher-value work');
}
if (packageJson.scripts?.['ops:sats-target-write'] !== 'node scripts/sats-target-agent.mjs write') {
  findings.push('package.json must expose ops:sats-target-write');
}
if (!/TARGET_JSON_PATH\s*=\s*join\('public', 'sats-target-plan\.json'\)/.test(targetAgent)) {
  findings.push('sats target agent must write public/sats-target-plan.json');
}
if (!/TARGET_MARKDOWN_PATH\s*=\s*join\('public', 'sats-target-plan\.md'\)/.test(targetAgent)) {
  findings.push('sats target agent must write public/sats-target-plan.md');
}
if (!existsSync(join('public', 'sats-target-plan.json'))) {
  findings.push('public/sats-target-plan.json must exist');
}
if (!existsSync(join('public', 'sats-target-plan.md'))) {
  findings.push('public/sats-target-plan.md must exist');
}
for (const expected of [
  'npm run ops:sats-target-write',
  'public/sats-target-plan.json',
  'public/sats-target-plan.md'
]) {
  if (!transparencyWorkflow.includes(expected)) {
    findings.push(`transparency report workflow must publish ${expected}`);
  }
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
