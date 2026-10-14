import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const request = readJson(join('use_case', 'agent-wallet-assignment-request.json'));
const queue = readJson(join('use_case', 'on-chain-agent-settlement-queue.json'));
const policy = readJson(join('use_case', 'on-chain-agent-settlement-policy.json'));
const executiveQueue = readJson(join('public', 'executive-approval-queue.json'));
const packageJson = readJson('package.json');
const findings = [];

if (request.schemaVersion !== 1) findings.push('request schemaVersion must be 1');
if (request.mode !== 'agent-sata-wallet-assignment-request') {
  findings.push('request mode must be agent-sata-wallet-assignment-request');
}
if (request.status !== 'ready-for-chairman-review') {
  findings.push('request status must be ready-for-chairman-review');
}
if (!request.approvalItemId) findings.push('request approvalItemId is required');

const proposal = (queue.proposals ?? []).find(
  (candidate) => candidate.id === request.settlementProposalId
);
if (!proposal) findings.push('request settlementProposalId must exist in settlement queue');
if (proposal && proposal.ledgerTransactionId !== request.ledgerTransactionId) {
  findings.push('request ledgerTransactionId must match settlement proposal');
}

const requestedAgents = new Set((request.requestedAssignments ?? []).map((item) => item.agentId));
for (const agentId of [proposal?.fromAgent, proposal?.toAgent].filter(Boolean)) {
  if (!requestedAgents.has(agentId)) {
    findings.push(`request missing wallet assignment for proposal agent ${agentId}`);
  }
}
for (const assignment of request.requestedAssignments ?? []) {
  if (assignment.publicKey !== 'pending-chairman-assignment') {
    findings.push(`${assignment.agentId}: publicKey must remain pending until chairman input exists`);
  }
  if (assignment.status !== 'awaiting-chairman-input') {
    findings.push(`${assignment.agentId}: status must be awaiting-chairman-input`);
  }
  const policyWallet = (policy.walletRegistry?.agents ?? []).find(
    (wallet) => wallet.id === assignment.agentId
  );
  if (!policyWallet) findings.push(`${assignment.agentId}: missing from wallet registry`);
  if (policyWallet && policyWallet.status !== 'unassigned') {
    findings.push(`${assignment.agentId}: registry wallet must remain unassigned before approval`);
  }
}

const searchable = JSON.stringify(request);
for (const forbidden of [/private key/i, /seed phrase/i, /secret recovery phrase/i, /keypair file/i]) {
  if (forbidden.test(searchable)) {
    findings.push(`request contains forbidden sensitive wording ${forbidden}`);
  }
}
for (const required of [
  /public Solana addresses only/i,
  /does not enable live execution/i,
  /preflight simulation/i,
  /separate chairman approval before signing/i
]) {
  if (!required.test(searchable)) findings.push(`request missing safety language ${required}`);
}

const approvalItem = (executiveQueue.items ?? []).find((item) => item.id === request.approvalItemId);
if (!approvalItem) findings.push('matching executive approval item is required');
if (approvalItem) {
  if (approvalItem.category !== 'wallet-custody') findings.push('approval item category must be wallet-custody');
  if (approvalItem.status !== 'ready-for-chairman-review') {
    findings.push('approval item status must be ready-for-chairman-review');
  }
  if (approvalItem.requiredChairmanApproval !== true) {
    findings.push('approval item must require chairman approval');
  }
  if (!JSON.stringify(approvalItem.evidence ?? []).includes('use_case/agent-wallet-assignment-request.json')) {
    findings.push('approval item evidence must reference the wallet assignment request');
  }
  if (!JSON.stringify(approvalItem).includes(request.settlementProposalId)) {
    findings.push('approval item must reference the settlement proposal');
  }
}

const scripts = packageJson.scripts ?? {};
if (
  scripts['ops:agent-wallet-assignment-check'] !==
  'node scripts/validate-agent-wallet-assignment-request.mjs'
) {
  findings.push('package.json missing ops:agent-wallet-assignment-check script');
}

if (findings.length > 0) {
  console.error('Agent wallet assignment request check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Agent wallet assignment request check passed: first settlement wallet assignment is chairman-gated.'
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
