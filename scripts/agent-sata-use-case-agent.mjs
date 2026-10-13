import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const POLICY_PATH = join('use_case', 'agent-sata-economy.json');
const LEDGER_PATH = join('use_case', 'agent-sata-ledger.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan'] = process.argv;
  const plan = await buildAgentSataUseCasePlan();

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(plan, null, 2));
      break;
    case 'markdown':
      console.log(renderAgentSataUseCaseMarkdown(plan));
      break;
    default:
      throw new Error(
        `Unknown agent SATA use case command: ${command}. Use plan, json, or markdown.`
      );
  }
}

export async function buildAgentSataUseCasePlan() {
  const [policy, ledger] = await Promise.all([readJson(POLICY_PATH), readJson(LEDGER_PATH)]);
  validatePolicy(policy);
  validateLedger(ledger, policy);

  return {
    mode: policy.mode,
    visibility: policy.visibility,
    objective: policy.objective,
    boundary: policy.boundary,
    computeBudget: policy.computeBudget,
    ledgerStatus: ledger.status,
    transactionCount: ledger.transactions.length,
    balances: computeBalances(policy, ledger),
    nextAction: ledger.nextAction,
    operatingRule:
      'Every delegated agent interaction should be quoted, accepted, evidenced, and settled in the private SATA ledger before it is treated as completed.'
  };
}

export function renderAgentSataUseCaseMarkdown(plan) {
  const balances = Object.entries(plan.balances)
    .map(([agent, balance]) => `- ${agent}: ${balance} SATA`)
    .join('\n');

  return `# Agent SATA Use Case Plan

Mode: ${plan.mode}
Visibility: ${plan.visibility}
Ledger status: ${plan.ledgerStatus}
Transactions: ${plan.transactionCount}

## Objective

${plan.objective}

## Boundary

- Not on-chain: ${plan.boundary.notOnChain}
- No asset movement: ${plan.boundary.noAssetMovement}
- No wallet authority: ${plan.boundary.noWalletAuthority}
- No market value claim: ${plan.boundary.noMarketValueClaim}

## Balances

${balances}

## Next Action

${plan.nextAction}

## Operating Rule

${plan.operatingRule}
`;
}

function computeBalances(policy, ledger) {
  const balances = Object.fromEntries(
    policy.agents.map((agent) => [agent.id, Number(agent.startingBalanceSata)])
  );

  for (const transaction of ledger.transactions) {
    if (transaction.status !== 'settled') continue;
    const amount = Number(transaction.sataAmount);
    balances[transaction.fromAgent] = (balances[transaction.fromAgent] ?? 0) - amount;
    balances[transaction.toAgent] = (balances[transaction.toAgent] ?? 0) + amount;
  }

  return Object.fromEntries(
    Object.entries(balances).map(([agent, balance]) => [agent, balance.toFixed(6)])
  );
}

function validatePolicy(policy) {
  if (policy.schemaVersion !== 1) throw new Error('Policy schemaVersion must be 1.');
  if (policy.mode !== 'private-agent-sata-economy') {
    throw new Error('Policy mode must be private-agent-sata-economy.');
  }
  for (const [key, value] of Object.entries(policy.boundary ?? {})) {
    if (value !== true) throw new Error(`Boundary flag must be true: ${key}`);
  }
}

function validateLedger(ledger, policy) {
  if (ledger.schemaVersion !== 1) throw new Error('Ledger schemaVersion must be 1.');
  const policyPath = POLICY_PATH.replaceAll('\\', '/');
  if (ledger.policyFile !== policyPath) throw new Error(`Ledger policyFile must be ${policyPath}.`);
  if (ledger.realAssetMovement !== false) throw new Error('Ledger must not move real assets.');
  if (ledger.publicReserveImpact !== false)
    throw new Error('Ledger must not affect public reserve state.');
  if (!Array.isArray(ledger.transactions)) throw new Error('Ledger transactions must be an array.');

  const agents = new Set(policy.agents.map((agent) => agent.id));
  const types = new Set(policy.transactionTypes.map((type) => type.id));
  const requiredFields = policy.requiredTransactionFields;

  for (const transaction of ledger.transactions) {
    for (const field of requiredFields) {
      if (!(field in transaction)) throw new Error(`Transaction missing field ${field}.`);
    }
    if (!agents.has(transaction.fromAgent))
      throw new Error(`Unknown fromAgent: ${transaction.fromAgent}`);
    if (!agents.has(transaction.toAgent))
      throw new Error(`Unknown toAgent: ${transaction.toAgent}`);
    if (!types.has(transaction.type))
      throw new Error(`Unknown transaction type: ${transaction.type}`);
    if (!Number.isFinite(Number(transaction.sataAmount))) {
      throw new Error(`Invalid transaction sataAmount: ${transaction.sataAmount}`);
    }
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
