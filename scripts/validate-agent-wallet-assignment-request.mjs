import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const request = readJson(join('use_case', 'agent-wallet-assignment-request.json'));
const queue = readJson(join('use_case', 'on-chain-agent-settlement-queue.json'));
const policy = readJson(join('use_case', 'on-chain-agent-settlement-policy.json'));
const executiveQueue = readJson(join('public', 'executive-approval-queue.json'));
const packageJson = readJson('package.json');
const assignmentAgentSource = readFileSync(
  join('scripts', 'agent-wallet-assignment-agent.mjs'),
  'utf8'
);
const findings = [];
const SOLANA_PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

if (request.schemaVersion !== 1) findings.push('request schemaVersion must be 1');
if (request.mode !== 'agent-sata-wallet-assignment-request') {
  findings.push('request mode must be agent-sata-wallet-assignment-request');
}
if (!['ready-for-chairman-review', 'applied-awaiting-simulation'].includes(request.status)) {
  findings.push('request status must be ready-for-chairman-review or applied-awaiting-simulation');
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

const approvalItem = (executiveQueue.items ?? []).find(
  (item) => item.id === request.approvalItemId
);
if (!approvalItem) findings.push('matching executive approval item is required');
const chairmanApproved =
  approvalItem?.status === 'approved-by-chairman' &&
  approvalItem?.approvedBy === 'executive-chairman';
if (request.status === 'applied-awaiting-simulation') {
  if (!chairmanApproved) findings.push('applied assignment requires chairman approval');
  if (proposal?.status !== 'draft-wallets-assigned-awaiting-simulation') {
    findings.push('applied assignment requires matching proposal state');
  }
  for (const [agentId, field] of [
    [proposal?.fromAgent, 'sourcePublicKey'],
    [proposal?.toAgent, 'recipientPublicKey']
  ]) {
    const assignment = request.requestedAssignments?.find((item) => item.agentId === agentId);
    if (!assignment || assignment.publicKey !== proposal?.[field]) {
      findings.push('proposal addresses must match the assignment');
    }
  }
  if (!request.feeRentPayer || request.feeRentPayer !== proposal?.feeRentPayer) {
    findings.push('fee payer must match the assignment');
  }
}

for (const assignment of request.requestedAssignments ?? []) {
  const policyWallet = (policy.walletRegistry?.agents ?? []).find(
    (wallet) => wallet.id === assignment.agentId
  );
  if (!policyWallet) findings.push(`${assignment.agentId}: missing from wallet registry`);

  if (!chairmanApproved || request.status === 'ready-for-chairman-review') {
    if (assignment.publicKey !== 'pending-chairman-assignment') {
      findings.push(
        `${assignment.agentId}: publicKey must remain pending until chairman input exists`
      );
    }
    if (assignment.status !== 'awaiting-chairman-input') {
      findings.push(`${assignment.agentId}: status must be awaiting-chairman-input`);
    }
    if (policyWallet && policyWallet.status !== 'unassigned') {
      findings.push(
        `${assignment.agentId}: registry wallet must remain unassigned before approval`
      );
    }
  } else {
    if (!SOLANA_PUBLIC_KEY_PATTERN.test(assignment.publicKey)) {
      findings.push(`${assignment.agentId}: assigned publicKey must be a Solana public address`);
    }
    if (assignment.status !== 'assigned-awaiting-simulation') {
      findings.push(
        `${assignment.agentId}: status must be assigned-awaiting-simulation after apply`
      );
    }
    if (policyWallet && policyWallet.status !== 'assigned') {
      findings.push(`${assignment.agentId}: registry wallet must be assigned after apply`);
    }
    if (policyWallet && policyWallet.publicKey !== assignment.publicKey) {
      findings.push(`${assignment.agentId}: request and registry publicKey must match`);
    }
  }
}

const searchable = JSON.stringify(request);
for (const forbidden of [
  /private key/i,
  /seed phrase/i,
  /secret recovery phrase/i,
  /keypair file/i
]) {
  if (forbidden.test(searchable)) {
    findings.push(`request contains forbidden sensitive wording ${forbidden}`);
  }
}
for (const required of [
  /public Solana addresses only|Only public Solana addresses may be recorded/i,
  /does not enable live execution/i,
  /preflight simulation/i,
  /separate chairman approval before signing/i
]) {
  if (!required.test(searchable)) findings.push(`request missing safety language ${required}`);
}

if (approvalItem) {
  if (approvalItem.category !== 'wallet-custody')
    findings.push('approval item category must be wallet-custody');
  if (!['ready-for-chairman-review', 'approved-by-chairman'].includes(approvalItem.status)) {
    findings.push('approval item status must be ready-for-chairman-review or approved-by-chairman');
  }
  if (approvalItem.requiredChairmanApproval !== true) {
    findings.push('approval item must require chairman approval');
  }
  if (
    !JSON.stringify(approvalItem.evidence ?? []).includes(
      'use_case/agent-wallet-assignment-request.json'
    )
  ) {
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
if (
  scripts['ops:agent-wallet-assignment-plan'] !==
  'node scripts/agent-wallet-assignment-agent.mjs plan'
) {
  findings.push('package.json missing ops:agent-wallet-assignment-plan script');
}
if (
  scripts['ops:agent-wallet-assignment-apply'] !==
  'node scripts/agent-wallet-assignment-agent.mjs apply'
) {
  findings.push('package.json missing ops:agent-wallet-assignment-apply script');
}

for (const required of [
  /records public Solana addresses only/i,
  /never stores signing material/i,
  /signs transactions/i,
  /submits transactions/i,
  /approved-by-chairman/i
]) {
  if (!required.test(assignmentAgentSource)) {
    findings.push(`assignment agent missing safety guard ${required}`);
  }
}
if (!/source and recipient agent addresses must be different/i.test(assignmentAgentSource)) {
  findings.push('assignment agent must reject source and recipient address reuse');
}
if (!/live execution is enabled/i.test(assignmentAgentSource)) {
  findings.push('assignment agent must refuse apply while live execution is enabled');
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
