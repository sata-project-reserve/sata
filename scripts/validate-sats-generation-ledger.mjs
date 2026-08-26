import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ledger = JSON.parse(readFileSync(join('public', 'sats-generation-ledger.json'), 'utf8'));
const findings = [];

if (ledger.schemaVersion !== 1) findings.push('schemaVersion must be 1');
if (ledger.mode !== 'sats-generation-ledger') findings.push('mode must be sats-generation-ledger');
if (!/confirmed BTC reserve sats/i.test(ledger.objective ?? '')) {
  findings.push('objective must target confirmed BTC reserve sats');
}
if (BigInt(ledger.target?.targetSats ?? '0') !== 1_000_000_000n) {
  findings.push('target.targetSats must be 1000000000');
}

const allocation = ledger.unitEconomics?.defaultPostReceiptAllocationPercent ?? {};
const allocationTotal =
  Number(allocation.btcReserve ?? 0) +
  Number(allocation.liquidity ?? 0) +
  Number(allocation.operatingBudget ?? 0);
if (allocationTotal !== 100) {
  findings.push('defaultPostReceiptAllocationPercent must total 100');
}
if (!/Do not estimate or promise sats before execution/i.test(ledger.unitEconomics?.conversionRule ?? '')) {
  findings.push('conversionRule must prohibit pre-execution sats promises');
}

const pipeline = ledger.pipeline ?? [];
if (pipeline.length < 1) findings.push('pipeline must include at least one sats-generation opportunity');
for (const item of pipeline) {
  for (const field of ['id', 'source', 'stage', 'offerId', 'targetRevenueUsd', 'targetSats', 'nextAction']) {
    if (!item[field] || typeof item[field] !== 'string') {
      findings.push(`${item.id ?? '<missing-id>'}: missing string field ${field}`);
    }
  }
  if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
    findings.push(`${item.id ?? '<missing-id>'}: evidence must include at least one link`);
  }
  if (/guaranteed|profit|return|moon|pump/i.test(JSON.stringify(item))) {
    findings.push(`${item.id ?? '<missing-id>'}: pipeline item contains prohibited promotional language`);
  }
}

for (const receipt of ledger.receipts ?? []) {
  for (const field of ledger.requiredReceiptFields ?? []) {
    if (!receipt[field]) findings.push(`${receipt.id ?? '<missing-receipt-id>'}: missing receipt field ${field}`);
  }
}

for (const allocationItem of ledger.allocations ?? []) {
  for (const field of ledger.requiredAllocationFields ?? []) {
    if (!allocationItem[field]) {
      findings.push(`${allocationItem.id ?? '<missing-allocation-id>'}: missing allocation field ${field}`);
    }
  }
}

const prohibited = (ledger.prohibitedRoutes ?? []).join('\n');
for (const required of [
  /wash trading|artificial volume/i,
  /hidden selling/i,
  /undisclosed paid promotion/i,
  /fake engagement|bots|raids|investor lists/i,
  /unapproved token grants/i,
  /unapproved liquidity removal/i,
  /private keys|seed phrases/i,
  /promising price|profit|return|redemption|market support/i
]) {
  if (!required.test(prohibited)) findings.push(`prohibitedRoutes missing ${required}`);
}

if (findings.length > 0) {
  console.error('Sats generation ledger check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Sats generation ledger check passed: pipeline and receipt gates are enforceable.');
