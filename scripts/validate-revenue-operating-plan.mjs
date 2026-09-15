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
if (!streams.some((stream) => stream.id === 'transparency-audit' && stream.priceUsd === '249')) {
  findings.push('revenueStreams must include a $249 transparency-audit entry');
}
if (!streams.some((stream) => stream.id === 'full-proof-dashboard' && stream.priceUsd === '4999')) {
  findings.push('revenueStreams must include a $4999 continuous monitoring entry');
}
for (const stream of streams) {
  for (const field of ['id', 'label', 'priceUsd', 'deliverable', 'paymentTiming']) {
    if (!stream[field] || typeof stream[field] !== 'string') {
      findings.push(`${stream.id ?? '<missing-id>'}: missing string field ${field}`);
    }
  }
}

const upgradePolicy = plan.upgradePolicy ?? {};
if (!/Increase average deal value/i.test(upgradePolicy.objective ?? '')) {
  findings.push('upgradePolicy.objective must define the average-deal-value goal');
}
if ((upgradePolicy.defaultPath ?? []).length < 3) {
  findings.push('upgradePolicy.defaultPath must include starter, setup, and dashboard steps');
}
if (!(upgradePolicy.qualificationQuestions ?? []).some((question) => /automated dashboard/i.test(question))) {
  findings.push('upgradePolicy.qualificationQuestions must qualify dashboard demand');
}
if (!(upgradePolicy.defaultPath ?? []).some((step) => /\$249/.test(step))) {
  findings.push('upgradePolicy.defaultPath must start from the $249 audit offer');
}
const upgradeStopRules = (upgradePolicy.stopRules ?? []).join('\n');
for (const required of [
  /Do not pressure/i,
  /price|liquidity|trading volume|buyer demand/i,
  /chairman-approved scope and invoice/i
]) {
  if (!required.test(upgradeStopRules)) {
    findings.push(`upgradePolicy.stopRules missing ${required}`);
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

const planning = plan.planningAssumptions ?? {};
if (!/^\d+(\.\d+)?$/.test(planning.btcUsd ?? '') || Number(planning.btcUsd) <= 0) {
  findings.push('planningAssumptions.btcUsd must be a positive decimal string');
}
if (!/operator planning assumption, not a live quote/i.test(planning.btcUsdSource ?? '')) {
  findings.push('planningAssumptions.btcUsdSource must mark BTC/USD as an operator planning assumption');
}
if (!/fresh chairman-selected BTC\/USD rate/i.test(planning.reserveImpactRule ?? '')) {
  findings.push('planningAssumptions.reserveImpactRule must require a fresh chairman-selected invoice rate');
}
if (!/confirmed receipt and chairman-approved allocation/i.test(planning.actualSatsRule ?? '')) {
  findings.push('planningAssumptions.actualSatsRule must require confirmed receipt and chairman-approved allocation');
}

const rules = (plan.goToMarketRules ?? []).join('\n');
for (const required of [
  /Revenue First/i,
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
if (plan.nextCycle?.targetClosedRevenueUsd !== '996') {
  findings.push('nextCycle.targetClosedRevenueUsd must target four $249 audits');
}
if (plan.nextCycle?.minimumAcceptableFirstDealUsd !== '249') {
  findings.push('nextCycle.minimumAcceptableFirstDealUsd must be $249');
}
const successCriteria = (plan.nextCycle?.successCriteria ?? []).join('\n');
for (const required of [/Customers/i, /Revenue/i, /Reserve sats/i, /Recurring revenue/i]) {
  if (!required.test(successCriteria)) {
    findings.push(`nextCycle.successCriteria missing revenue-first metric ${required}`);
  }
}

if (findings.length > 0) {
  console.error('Revenue operating plan check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Revenue operating plan check passed: revenue actions are bounded and reviewable.');
