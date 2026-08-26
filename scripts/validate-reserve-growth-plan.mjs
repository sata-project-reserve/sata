import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const plan = JSON.parse(readFileSync(join('public', 'reserve-growth-plan.json'), 'utf8'));
const findings = [];
const targetSats = BigInt(plan.target?.targetSats ?? '0');

if (plan.schemaVersion !== 1) findings.push('schemaVersion must be 1');
if (targetSats !== 1_000_000_000n) findings.push('target.targetSats must be 1000000000');
if (plan.target?.targetBtc !== '10') findings.push('target.targetBtc must be 10');
if (!/not a redemption promise|no redemption promise/i.test(plan.publicLanguage?.allowed ?? '')) {
  findings.push('publicLanguage.allowed must include no-redemption language');
}
if (!/No price guarantee/i.test(plan.publicLanguage?.requiredCaveat ?? '')) {
  findings.push('publicLanguage.requiredCaveat must include no-price-guarantee language');
}

const milestones = plan.milestones ?? [];
let previous = 0n;
for (const milestone of milestones) {
  const sats = BigInt(milestone.sats ?? '0');
  if (sats <= previous) findings.push(`milestone ${milestone.label} is not increasing`);
  previous = sats;
}
if (previous !== targetSats) findings.push('final milestone must equal target.targetSats');

const routeIds = new Set((plan.allowedRoutes ?? []).map((route) => route.id));
for (const required of [
  'chairman-funded-tranche',
  'operating-revenue-allocation',
  'grant-or-donation',
  'asset-conversion'
]) {
  if (!routeIds.has(required)) findings.push(`missing allowed route ${required}`);
}

const prohibited = (plan.prohibitedRoutes ?? []).join('\n');
for (const required of [
  /wash trading|artificial volume/i,
  /undisclosed paid promotion/i,
  /hidden selling/i,
  /private keys|seed phrases/i,
  /unapproved liquidity removal/i
]) {
  if (!required.test(prohibited)) findings.push(`missing prohibited route matching ${required}`);
}

if (findings.length > 0) {
  console.error('Reserve growth plan check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Reserve growth plan check passed: 1B sats operating target is valid.');
