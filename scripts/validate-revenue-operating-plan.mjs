import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const plan = JSON.parse(readFileSync(join('public', 'revenue-operating-plan.json'), 'utf8'));
const findings = [];

if (plan.schemaVersion !== 1) findings.push('schemaVersion must be 1');
if (plan.mode !== 'revenue-first-reserve-growth') {
  findings.push('mode must be revenue-first-reserve-growth');
}
if (!/1,000,000,000 sats/i.test(plan.objective ?? '')) {
  findings.push('objective must reference the 1,000,000,000 sats reserve target');
}

const cannot = (plan.agentBoundary?.agentCannot ?? []).join('\n');
for (const required of [
  /private keys|seed phrases/i,
  /move .*BTC.*SOL.*SATA/i,
  /trade project assets/i,
  /promise .*price|promise .*return|promise .*redemption|promise .*market support/i
]) {
  if (!required.test(cannot)) findings.push(`agentBoundary.agentCannot missing ${required}`);
}

const streams = plan.revenueStreams ?? [];
if (streams.length < 3) findings.push('revenueStreams must include at least three offers');
if (!streams.some((stream) => stream.id === 'transparency-audit' && stream.priceUsd === '50')) {
  findings.push('revenueStreams must include a $50 transparency-audit entry');
}
for (const stream of streams) {
  for (const field of ['id', 'label', 'priceUsd', 'deliverable', 'paymentTiming']) {
    if (!stream[field] || typeof stream[field] !== 'string') {
      findings.push(`${stream.id ?? '<missing-id>'}: missing string field ${field}`);
    }
  }
}

const allocation = plan.allocationPolicy?.postReceiptAllocationPercent ?? {};
const allocationTotal =
  Number(allocation.btcReserve ?? 0) +
  Number(allocation.liquidity ?? 0) +
  Number(allocation.operatingBudget ?? 0);
if (allocationTotal !== 100) findings.push('postReceiptAllocationPercent must total 100');
if (plan.allocationPolicy?.requiresChairmanApprovalBeforeConversion !== true) {
  findings.push('allocationPolicy must require chairman approval before conversion');
}

const rules = (plan.goToMarketRules ?? []).join('\n');
for (const required of [
  /proof tooling|public reporting/i,
  /Sponsored|Paid Partnership/i,
  /fake engagement|bots|raids|investor lists/i,
  /undisclosed compensation/i
]) {
  if (!required.test(rules)) findings.push(`goToMarketRules missing ${required}`);
}

const prohibited = (plan.prohibitedRoutes ?? []).join('\n');
for (const required of [
  /hidden selling/i,
  /wash trading|artificial volume/i,
  /undisclosed paid promotion/i,
  /fake engagement|bots|raids|investor lists/i,
  /unapproved token grants/i,
  /unapproved liquidity removal/i,
  /guaranteed price floor/i,
  /private keys|seed phrases/i
]) {
  if (!required.test(prohibited)) findings.push(`prohibitedRoutes missing ${required}`);
}

if (!/No price guarantee/i.test(plan.publicLanguage?.requiredCaveat ?? '')) {
  findings.push('publicLanguage.requiredCaveat must include no-price-guarantee language');
}
if (!/no revenue guarantee/i.test(plan.publicLanguage?.requiredCaveat ?? '')) {
  findings.push('publicLanguage.requiredCaveat must include no-revenue-guarantee language');
}

if (findings.length > 0) {
  console.error('Revenue operating plan check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Revenue operating plan check passed: revenue actions are bounded and reviewable.');
