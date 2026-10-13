import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const policy = readJson(join('use_case', 'on-chain-agent-settlement-policy.json'));
const queue = readJson(join('use_case', 'on-chain-agent-settlement-queue.json'));
const privatePolicy = readJson(join('use_case', 'agent-sata-economy.json'));
const privateLedger = readJson(join('use_case', 'agent-sata-ledger.json'));
const architecture = readJson(join('use_case', 'engineering-economy-architecture.json'));
const report = readJson(join('public', 'transparency', 'latest.json'));
const packageJson = readJson('package.json');
const readme = readFileSync(join('use_case', 'README.md'), 'utf8');
const settlementAgent = readFileSync(join('scripts', 'on-chain-agent-settlement-agent.mjs'), 'utf8');
const findings = [];

if (policy.schemaVersion !== 1) findings.push('policy schemaVersion must be 1');
if (policy.mode !== 'chairman-approved-agent-sata-on-chain-settlement') {
  findings.push('policy mode must be chairman-approved-agent-sata-on-chain-settlement');
}
if (policy.visibility !== 'private-use-case') findings.push('policy visibility must be private-use-case');
if (policy.status !== 'planning-not-live') findings.push('policy status must remain planning-not-live');
if (!/selected private agent SATA ledger entries/i.test(policy.objective ?? '')) {
  findings.push('policy objective must tie on-chain settlement to private agent SATA ledger entries');
}

if (policy.privateAccountingSource?.policyFile !== 'use_case/agent-sata-economy.json') {
  findings.push('policy must reference use_case/agent-sata-economy.json');
}
if (policy.privateAccountingSource?.ledgerFile !== 'use_case/agent-sata-ledger.json') {
  findings.push('policy must reference use_case/agent-sata-ledger.json');
}
if (policy.privateAccountingSource?.architectureFile !== 'use_case/engineering-economy-architecture.json') {
  findings.push('policy must reference use_case/engineering-economy-architecture.json');
}

if (policy.network?.cluster !== 'mainnet-beta') findings.push('network.cluster must be mainnet-beta');
if (policy.network?.devnetDryRunAllowed !== true) {
  findings.push('network.devnetDryRunAllowed must be true for dry-run safety');
}
if (policy.network?.liveExecutionEnabled !== false) {
  findings.push('policy network liveExecutionEnabled must be false');
}
if (policy.transactionPolicy?.realAssetMovementEnabled !== false) {
  findings.push('transactionPolicy.realAssetMovementEnabled must be false');
}
if (policy.transactionPolicy?.proposalOnlyUntilApproved !== true) {
  findings.push('transactionPolicy.proposalOnlyUntilApproved must be true');
}

const expectedMint = report.solana?.sataMint;
if (policy.sataToken?.mintAddress !== expectedMint) {
  findings.push('policy SATA mint must match public/transparency/latest.json solana.sataMint');
}
if (policy.sataToken?.tokenProgram !== report.solana?.tokenProgram) {
  findings.push('policy token program must match latest transparency report');
}
if (policy.sataToken?.decimals !== report.solana?.decimals) {
  findings.push('policy decimals must match latest transparency report');
}

for (const required of [
  'requiresPrivateLedgerEntry',
  'requiresTaskEvidence',
  'requiresIdempotencyKey',
  'requiresMemo',
  'requiresMemoContentHash',
  'requiresPreflightSimulation',
  'requiresChairmanApproval',
  'requiresHumanSignerUntilMultisigApproved',
  'requiresExplorerUrlBeforeSettled',
  'requiresRecipientAtaCheck',
  'requiresFeeBudgetCheck',
  'requiresMintAndDecimalsCheck',
  'requiresNoPrivateKeyInRepoCheck'
]) {
  if (policy.transactionPolicy?.[required] !== true) {
    findings.push(`transactionPolicy.${required} must be true`);
  }
}
if (policy.transactionPolicy?.requiresConfirmationLevel !== 'finalized') {
  findings.push('transactionPolicy.requiresConfirmationLevel must be finalized');
}
if (!/idempotency key/i.test(policy.transactionPolicy?.idempotencyRule ?? '')) {
  findings.push('transactionPolicy.idempotencyRule must mention idempotency key');
}
if (!/hash=<memoContentHash>/.test(policy.transactionPolicy?.memoTemplate ?? '')) {
  findings.push('transactionPolicy.memoTemplate must include memoContentHash');
}
for (const pendingCap of ['perTransactionMaxSata', 'dailyMaxSata']) {
  if (policy.transactionPolicy?.[pendingCap] !== 'pending-chairman-input') {
    findings.push(`transactionPolicy.${pendingCap} must remain pending-chairman-input`);
  }
}
if (Number(policy.transactionPolicy?.dustThresholdSata ?? 0) <= 0) {
  findings.push('transactionPolicy.dustThresholdSata must be positive');
}

const requiredAgentIds = new Set(privatePolicy.agents.map((agent) => agent.id));
const architectureAgents =
  (architecture.layers ?? []).find((layer) => layer.id === 'specialized-agents')?.agents ?? [];
for (const agent of architectureAgents) requiredAgentIds.add(agent.id);
const registeredAgents = new Set((policy.walletRegistry?.agents ?? []).map((agent) => agent.id));
for (const agentId of requiredAgentIds) {
  if (!registeredAgents.has(agentId)) findings.push(`walletRegistry missing ${agentId}`);
}
if (policy.walletRegistry?.status !== 'awaiting-chairman-wallet-assignment') {
  findings.push('walletRegistry.status must be awaiting-chairman-wallet-assignment');
}
for (const wallet of policy.walletRegistry?.agents ?? []) {
  if (!['assigned', 'unassigned', 'frozen'].includes(wallet.status)) {
    findings.push(`${wallet.id}: invalid wallet status ${wallet.status}`);
  }
  if (wallet.status === 'assigned' && !isLikelySolanaPublicKey(wallet.publicKey)) {
    findings.push(`${wallet.id}: assigned publicKey is not a valid-looking Solana public key`);
  }
  if (wallet.status !== 'assigned' && wallet.publicKey !== 'pending-chairman-assignment') {
    findings.push(`${wallet.id}: unassigned/frozen wallets must not carry an active publicKey`);
  }
}

const policyAndQueue = { policy, queue };
for (const keyPath of findSecretKeyPaths(policyAndQueue)) {
  findings.push(`secret-like key is not allowed in settlement config: ${keyPath}`);
}

const edgeCases = new Set((policy.edgeCases ?? []).map((edgeCase) => edgeCase.id));
for (const requiredEdgeCase of [
  'duplicate-or-replay',
  'failed-transaction',
  'partial-settlement',
  'wrong-recipient',
  'stale-blockhash',
  'insufficient-sol-fee-budget',
  'missing-associated-token-account',
  'decimals-or-mint-mismatch',
  'network-congestion',
  'fork-or-rpc-inconsistency',
  'compromised-agent-wallet',
  'agent-disputes-work',
  'over-budget-task',
  'private-ledger-chain-mismatch',
  'privacy-leak',
  'address-typo',
  'chain-halt-or-rpc-failure',
  'unauthorized-token-grant',
  'tax-accounting-reporting'
]) {
  if (!edgeCases.has(requiredEdgeCase)) findings.push(`edgeCases missing ${requiredEdgeCase}`);
}

if (queue.schemaVersion !== 1) findings.push('queue schemaVersion must be 1');
if (queue.mode !== 'agent-sata-on-chain-settlement-queue') {
  findings.push('queue mode must be agent-sata-on-chain-settlement-queue');
}
if (queue.policyFile !== 'use_case/on-chain-agent-settlement-policy.json') {
  findings.push('queue policyFile must reference the settlement policy');
}
if (queue.liveExecutionEnabled !== false) findings.push('queue.liveExecutionEnabled must be false');
if (queue.realAssetMovement !== false) findings.push('queue.realAssetMovement must be false');
if (!Array.isArray(queue.proposals)) findings.push('queue.proposals must be an array');
if (!Array.isArray(queue.executedTransactions)) findings.push('queue.executedTransactions must be an array');
if (!/wallet/i.test(queue.nextAction ?? '')) findings.push('queue.nextAction must point to wallet assignment');

validateProposals(queue.proposals ?? [], privateLedger, registeredAgents, policy);
validateExecutedTransactions(queue.executedTransactions ?? [], queue.proposals ?? []);

for (const required of [
  /On-Chain Settlement Readiness/i,
  /separate approval layer/i,
  /does not create, sign, submit, or retry/i,
  /chairman-approved public Solana addresses/i,
  /idempotency/i,
  /preflight simulation/i,
  /finalized confirmation/i
]) {
  if (!required.test(readme)) findings.push(`README missing ${required}`);
}

const scripts = packageJson.scripts ?? {};
if (
  scripts['ops:on-chain-agent-settlement-check'] !==
  'node scripts/validate-on-chain-agent-settlement.mjs'
) {
  findings.push('package.json missing ops:on-chain-agent-settlement-check script');
}
if (
  scripts['ops:on-chain-agent-settlement-plan'] !==
  'node scripts/on-chain-agent-settlement-agent.mjs plan'
) {
  findings.push('package.json missing ops:on-chain-agent-settlement-plan script');
}
if (!/does not create, sign, submit, or retry Solana transactions/i.test(settlementAgent)) {
  findings.push('settlement agent must disclose that it cannot create/sign/submit/retry transactions');
}

if (findings.length > 0) {
  console.error('On-chain agent settlement check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'On-chain agent settlement check passed: settlement is gated, proposal-only, and edge-case covered.'
);

function validateProposals(proposals, privateLedger, registeredAgents, policyConfig) {
  const seenIdempotencyKeys = new Set();
  const seenLedgerIds = new Set();
  const seenMemoHashes = new Set();
  const privateTransactions = new Set((privateLedger.transactions ?? []).map((tx) => tx.id));
  const assignedAgents = new Set(
    (policyConfig.walletRegistry?.agents ?? [])
      .filter((agent) => agent.status === 'assigned')
      .map((agent) => agent.id)
  );

  for (const proposal of proposals) {
    for (const field of [
      'id',
      'ledgerTransactionId',
      'taskId',
      'fromAgent',
      'toAgent',
      'sataAmount',
      'memo',
      'memoContentHash',
      'idempotencyKey',
      'status'
    ]) {
      if (!proposal[field]) findings.push(`${proposal.id ?? '<missing-proposal-id>'}: missing ${field}`);
    }
    if (!registeredAgents.has(proposal.fromAgent)) {
      findings.push(`${proposal.id}: unknown fromAgent ${proposal.fromAgent}`);
    }
    if (!registeredAgents.has(proposal.toAgent)) {
      findings.push(`${proposal.id}: unknown toAgent ${proposal.toAgent}`);
    }
    if (proposal.fromAgent === proposal.toAgent) findings.push(`${proposal.id}: cannot self-settle`);
    if (Number(proposal.sataAmount ?? 0) <= Number(policyConfig.transactionPolicy.dustThresholdSata)) {
      findings.push(`${proposal.id}: sataAmount must be above dustThresholdSata`);
    }
    trackUnique(seenIdempotencyKeys, proposal.idempotencyKey, `${proposal.id}: duplicate idempotencyKey`);
    trackUnique(seenLedgerIds, proposal.ledgerTransactionId, `${proposal.id}: duplicate ledgerTransactionId`);
    trackUnique(seenMemoHashes, proposal.memoContentHash, `${proposal.id}: duplicate memoContentHash`);

    if (!privateTransactions.has(proposal.ledgerTransactionId)) {
      findings.push(`${proposal.id}: ledgerTransactionId must exist in private agent SATA ledger`);
    }
    if (!/SATA_AGENT_SETTLEMENT/.test(proposal.memo ?? '')) {
      findings.push(`${proposal.id}: memo must use SATA_AGENT_SETTLEMENT template`);
    }
    if (['simulated', 'approved', 'ready-to-sign', 'submitted', 'confirmed'].includes(proposal.status)) {
      for (const agentId of [proposal.fromAgent, proposal.toAgent]) {
        if (!assignedAgents.has(agentId)) {
          findings.push(`${proposal.id}: ${agentId} must have an assigned wallet before ${proposal.status}`);
        }
      }
      if (!proposal.simulation?.ok) findings.push(`${proposal.id}: simulation.ok is required before ${proposal.status}`);
      if (!proposal.chairmanApproval?.approvedAtUtc) {
        findings.push(`${proposal.id}: chairmanApproval.approvedAtUtc is required before ${proposal.status}`);
      }
    }
    if (proposal.status === 'confirmed') {
      if (!proposal.signature) findings.push(`${proposal.id}: confirmed proposal requires signature`);
      if (!/^https:\/\/explorer\.solana\.com\/tx\//.test(proposal.explorerUrl ?? '')) {
        findings.push(`${proposal.id}: confirmed proposal requires Solana explorer URL`);
      }
      if (proposal.confirmationLevel !== 'finalized') {
        findings.push(`${proposal.id}: confirmed proposal requires finalized confirmation`);
      }
    }
  }
}

function validateExecutedTransactions(transactions, proposals) {
  const confirmedProposals = new Set(
    proposals.filter((proposal) => proposal.status === 'confirmed').map((proposal) => proposal.id)
  );
  for (const tx of transactions) {
    if (!confirmedProposals.has(tx.proposalId)) {
      findings.push(`${tx.id ?? '<missing-executed-id>'}: executed transaction must map to confirmed proposal`);
    }
    if (!tx.signature) findings.push(`${tx.id ?? '<missing-executed-id>'}: missing signature`);
    if (tx.confirmationLevel !== 'finalized') {
      findings.push(`${tx.id ?? '<missing-executed-id>'}: confirmationLevel must be finalized`);
    }
  }
}

function trackUnique(set, value, message) {
  if (!value) return;
  if (set.has(value)) findings.push(message);
  set.add(value);
}

function findSecretKeyPaths(value, path = '$') {
  const matches = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => matches.push(...findSecretKeyPaths(item, `${path}[${index}]`)));
    return matches;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (/^(privateKey|secretKey|seedPhrase|mnemonic|keypair)$/i.test(key)) matches.push(childPath);
      matches.push(...findSecretKeyPaths(child, childPath));
    }
  }
  return matches;
}

function isLikelySolanaPublicKey(value) {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
