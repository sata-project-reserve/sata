import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const POLICY_PATH = join('use_case', 'on-chain-agent-settlement-policy.json');
const QUEUE_PATH = join('use_case', 'on-chain-agent-settlement-queue.json');
const LEDGER_PATH = join('use_case', 'agent-sata-ledger.json');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan'] = process.argv;
  const plan = await buildOnChainAgentSettlementPlan();

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(plan, null, 2));
      break;
    case 'markdown':
      console.log(renderOnChainAgentSettlementMarkdown(plan));
      break;
    default:
      throw new Error(
        `Unknown on-chain agent settlement command: ${command}. Use plan, json, or markdown.`
      );
  }
}

export async function buildOnChainAgentSettlementPlan() {
  const [policy, queue, ledger] = await Promise.all([
    readJson(POLICY_PATH),
    readJson(QUEUE_PATH),
    readJson(LEDGER_PATH)
  ]);
  const wallets = policy.walletRegistry.agents ?? [];
  const assignedWallets = wallets.filter((wallet) => wallet.status === 'assigned');
  const unassignedWallets = wallets.filter((wallet) => wallet.status !== 'assigned');
  const proposals = queue.proposals ?? [];
  const readyProposals = proposals.filter((proposal) =>
    ['simulated', 'approved', 'ready-to-sign'].includes(proposal.status)
  );
  const blockers = [];

  if (policy.network.liveExecutionEnabled !== true || queue.liveExecutionEnabled !== true) {
    blockers.push('Live execution is disabled; settlement is proposal-only.');
  }
  if (unassignedWallets.length > 0) {
    blockers.push(`${unassignedWallets.length} agent wallet(s) still need chairman assignment.`);
  }
  if ((ledger.transactions ?? []).length === 0) {
    blockers.push('No private agent SATA ledger entries exist to settle on-chain.');
  }
  if (readyProposals.length === 0) {
    blockers.push('No simulated chairman-reviewed settlement proposal is ready.');
  }

  return {
    mode: policy.mode,
    status: policy.status,
    cluster: policy.network.cluster,
    mintAddress: policy.sataToken.mintAddress,
    liveExecutionEnabled: policy.network.liveExecutionEnabled === true && queue.liveExecutionEnabled === true,
    queueStatus: queue.status,
    walletRegistryStatus: policy.walletRegistry.status,
    assignedWallets: assignedWallets.length,
    unassignedWallets: unassignedWallets.map((wallet) => wallet.id),
    privateLedgerTransactions: (ledger.transactions ?? []).length,
    queuedProposals: proposals.length,
    executedTransactions: (queue.executedTransactions ?? []).length,
    blockers,
    firstTransactionReadiness: blockers.length === 0 ? 'ready-for-chairman-signing-review' : 'blocked',
    nextAction: queue.nextAction,
    boundary:
      'This agent reads policy and queue state only. It does not create, sign, submit, or retry Solana transactions.'
  };
}

export function renderOnChainAgentSettlementMarkdown(plan) {
  const blockers = plan.blockers.map((blocker) => `- ${blocker}`).join('\n');
  const unassigned = plan.unassignedWallets.map((agent) => `- ${agent}`).join('\n');

  return `# On-Chain Agent SATA Settlement Plan

Mode: ${plan.mode}
Status: ${plan.status}
Cluster: ${plan.cluster}
SATA mint: ${plan.mintAddress}
Live execution enabled: ${plan.liveExecutionEnabled}
Queue status: ${plan.queueStatus}

## Readiness

First transaction readiness: ${plan.firstTransactionReadiness}
Private ledger transactions: ${plan.privateLedgerTransactions}
Queued proposals: ${plan.queuedProposals}
Executed transactions: ${plan.executedTransactions}
Assigned wallets: ${plan.assignedWallets}

## Blockers

${blockers || '- None'}

## Unassigned Wallets

${unassigned || '- None'}

## Next Action

${plan.nextAction}

## Boundary

${plan.boundary}
`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
