import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const policy = readJson(join('use_case', 'agent-sata-economy.json'));
const ledger = readJson(join('use_case', 'agent-sata-ledger.json'));
const readme = readFileSync(join('use_case', 'README.md'), 'utf8');
const packageJson = readJson('package.json');
const findings = [];

if (policy.schemaVersion !== 1) findings.push('policy schemaVersion must be 1');
if (policy.mode !== 'private-agent-sata-economy') {
  findings.push('policy mode must be private-agent-sata-economy');
}
if (policy.visibility !== 'private-use-case')
  findings.push('policy visibility must be private-use-case');
if (!/G:\\/.test(policy.objective ?? ''))
  findings.push('policy objective must reference G:\\ scope');
if (!/token waste/i.test(policy.objective ?? '')) {
  findings.push('policy objective must reference token waste reduction');
}

for (const flag of [
  'notOnChain',
  'notPublicReserve',
  'noAssetMovement',
  'noWalletAuthority',
  'noBrokerAuthority',
  'noMarketValueClaim',
  'chairmanApprovalRequiredForPublicOrFinancialUse'
]) {
  if (policy.boundary?.[flag] !== true) findings.push(`boundary.${flag} must be true`);
}

if (!/GitHub Pro subscription/i.test(policy.computeBudget?.source ?? '')) {
  findings.push('computeBudget.source must reference the GitHub Pro subscription');
}
if (policy.computeBudget?.budgetAmountStatus !== 'unset-pending-chairman-input') {
  findings.push('computeBudget.budgetAmountStatus must remain unset until chairman input exists');
}
if (policy.sataUnit?.type !== 'private accounting credit') {
  findings.push('sataUnit.type must be private accounting credit');
}
if (!/No market conversion/i.test(policy.sataUnit?.conversionPolicy ?? '')) {
  findings.push('sataUnit.conversionPolicy must reject market conversion');
}

const agents = policy.agents ?? [];
for (const requiredAgent of [
  'chairman',
  'primary-codex',
  'research-agent',
  'implementation-agent',
  'review-agent'
]) {
  if (!agents.some((agent) => agent.id === requiredAgent)) {
    findings.push(`agents missing ${requiredAgent}`);
  }
}
if (!agents.some((agent) => agent.id === 'chairman' && agent.canApproveBudgets === true)) {
  findings.push('chairman agent must retain budget approval authority');
}
if (agents.some((agent) => agent.id !== 'chairman' && agent.canApproveBudgets === true)) {
  findings.push('only chairman may approve budgets');
}

const transactionTypes = new Set((policy.transactionTypes ?? []).map((type) => type.id));
for (const requiredType of [
  'task_quote',
  'task_acceptance',
  'delegation_payment',
  'review_payment',
  'evidence_bonus',
  'rework_penalty',
  'refund',
  'settlement_close'
]) {
  if (!transactionTypes.has(requiredType))
    findings.push(`transactionTypes missing ${requiredType}`);
}

for (const requiredField of [
  'id',
  'timestampUtc',
  'taskId',
  'fromAgent',
  'toAgent',
  'type',
  'sataAmount',
  'computeBudgetUnits',
  'tokenEstimate',
  'evidence',
  'status',
  'settlementApproval'
]) {
  if (!(policy.requiredTransactionFields ?? []).includes(requiredField)) {
    findings.push(`requiredTransactionFields missing ${requiredField}`);
  }
}

const pricing = JSON.stringify(policy.pricingModel ?? {});
for (const required of [/reuse/i, /evidence/i, /penalty/i, /token/i]) {
  if (!required.test(pricing)) findings.push(`pricingModel missing ${required}`);
}

if (ledger.schemaVersion !== 1) findings.push('ledger schemaVersion must be 1');
if (ledger.mode !== 'private-agent-sata-ledger') {
  findings.push('ledger mode must be private-agent-sata-ledger');
}
if (ledger.status !== 'draft-private-use-case') {
  findings.push('ledger status must be draft-private-use-case');
}
if (ledger.policyFile !== 'use_case/agent-sata-economy.json') {
  findings.push('ledger must reference use_case/agent-sata-economy.json');
}
if (ledger.realAssetMovement !== false) findings.push('ledger.realAssetMovement must be false');
if (ledger.publicReserveImpact !== false) findings.push('ledger.publicReserveImpact must be false');
if (!Array.isArray(ledger.transactions)) findings.push('ledger.transactions must be an array');
if (!/first agent-to-agent task quote/i.test(ledger.nextAction ?? '')) {
  findings.push('ledger.nextAction must point to the first agent-to-agent task quote');
}

for (const required of [
  /private internal use case/i,
  /accounting metric/i,
  /GitHub Pro subscription/i,
  /agents interact/i,
  /associated private SATA accounting transaction/i,
  /not an on-chain transfer/i,
  /not a market trade/i,
  /not a claim on real custody/i,
  /conserve tokens/i
]) {
  if (!required.test(readme)) findings.push(`README missing ${required}`);
}

const scripts = packageJson.scripts ?? {};
if (scripts['ops:agent-sata-use-case-check'] !== 'node scripts/validate-agent-sata-use-case.mjs') {
  findings.push('package.json missing ops:agent-sata-use-case-check script');
}
if (scripts['ops:agent-sata-use-case-plan'] !== 'node scripts/agent-sata-use-case-agent.mjs plan') {
  findings.push('package.json missing ops:agent-sata-use-case-plan script');
}

if (findings.length > 0) {
  console.error('Agent SATA use case check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Agent SATA use case check passed: private agent accounting is bounded and reviewable.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
