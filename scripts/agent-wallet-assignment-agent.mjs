import { readFile, writeFile, open, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PublicKey } from '@solana/web3.js';

const REQUEST_PATH = join('use_case', 'agent-wallet-assignment-request.json');
const POLICY_PATH = join('use_case', 'on-chain-agent-settlement-policy.json');
const QUEUE_PATH = join('use_case', 'on-chain-agent-settlement-queue.json');
const APPROVAL_QUEUE_PATH = join('public', 'executive-approval-queue.json');
const SOLANA_PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command = 'plan', ...args] = process.argv;

  switch (command) {
    case 'plan':
    case 'json':
      console.log(JSON.stringify(await buildAgentWalletAssignmentPlan(), null, 2));
      break;
    case 'apply':
      console.log(JSON.stringify(await applyAgentWalletAssignment(parseArgs(args)), null, 2));
      break;
    default:
      throw new Error(`Unknown wallet assignment command: ${command}. Use plan, json, or apply.`);
  }
}

export async function buildAgentWalletAssignmentPlan() {
  const { request, policy, queue, approvalItem } = await readState();
  const proposal = findSettlementProposal(queue, request);
  const approvalReady =
    approvalItem?.status === 'approved-by-chairman' &&
    approvalItem?.approvedBy === 'executive-chairman';
  const requestedAgents = request.requestedAssignments ?? [];
  const registryAgents = policy.walletRegistry?.agents ?? [];
  const blockers = [];

  if (!approvalItem) blockers.push(`Missing executive approval item ${request.approvalItemId}`);
  if (!approvalReady)
    blockers.push(`${request.approvalItemId} is not approved by the Executive Chairman`);
  if (!proposal) blockers.push(`Missing settlement proposal ${request.settlementProposalId}`);
  if (policy.network?.liveExecutionEnabled === true || queue.liveExecutionEnabled === true) {
    blockers.push('Live execution must remain disabled during wallet assignment');
  }

  for (const assignment of requestedAgents) {
    const wallet = registryAgents.find((candidate) => candidate.id === assignment.agentId);
    if (!wallet) blockers.push(`${assignment.agentId} is missing from wallet registry`);
  }

  return {
    mode: request.mode,
    status: request.status,
    approvalItemId: request.approvalItemId,
    approvalStatus: approvalItem?.status ?? 'missing',
    approvalReady,
    settlementProposalId: request.settlementProposalId,
    proposalStatus: proposal?.status ?? 'missing',
    requestedAssignments: requestedAgents.map((assignment) => ({
      agentId: assignment.agentId,
      role: assignment.role,
      status: assignment.status,
      publicKeyAssigned: isSolanaPublicKey(assignment.publicKey)
    })),
    applyCommandTemplate:
      'npm run ops:agent-wallet-assignment-apply -- --primary-codex-address <public-address> --implementation-agent-address <public-address> --fee-rent-payer <public-address-or-policy> --confirm-chairman-approval "I am Executive Chairman and approve wallet assignment agent-wallet-assignment-20261013-first-settlement"',
    blockers,
    nextAction:
      blockers.length === 0
        ? 'Apply public wallet assignment, then prepare a non-signing simulation.'
        : request.nextAction,
    boundary:
      'This command records public Solana addresses only. It never stores signing material, creates keypairs, signs transactions, submits transactions, or moves assets.'
  };
}

export async function applyAgentWalletAssignment(args) {
  const lockPath = join('use_case', '.wallet-assignment.lock');
  const lock = await open(lockPath, 'wx');
  try {
    try {
      await access(join('use_case', '.wallet-assignment-recovery.json'));
      throw new Error('Incomplete assignment requires recovery review before retry');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return await applyLocked(args);
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

async function applyLocked(args) {
  const { request, policy, queue, approvalItem } = await readState();
  const proposal = findSettlementProposal(queue, request);
  const expectedPhrase = request.chairmanInputTemplate?.confirmationPhrase;
  const primaryAddress = args['primary-codex-address'];
  const implementationAddress = args['implementation-agent-address'];
  const feeRentPayer = args['fee-rent-payer'];
  const confirmation = args['confirm-chairman-approval'];

  assertSafeApplyArgs(args);

  if (!approvalItem) throw new Error(`Missing executive approval item ${request.approvalItemId}`);
  if (
    approvalItem.status !== 'approved-by-chairman' ||
    approvalItem.approvedBy !== 'executive-chairman'
  ) {
    throw new Error(
      `${request.approvalItemId} must be approved by the Executive Chairman before apply`
    );
  }
  if (confirmation !== expectedPhrase) {
    throw new Error(`Confirmation phrase must exactly match: ${expectedPhrase}`);
  }
  if (!proposal) throw new Error(`Missing settlement proposal ${request.settlementProposalId}`);
  if (
    request.status !== 'ready-for-chairman-review' ||
    proposal.status !== 'draft-wallets-unassigned'
  ) {
    throw new Error('Assignment already applied or proposal is no longer an unassigned draft');
  }
  if (
    proposal.ledgerTransactionId !== request.ledgerTransactionId ||
    proposal.fromAgent !== 'primary-codex' ||
    proposal.toAgent !== 'implementation-agent'
  ) {
    throw new Error('Proposal does not match the requested ledger and agent pair');
  }
  for (const id of ['primary-codex', 'implementation-agent']) {
    const wallets = (policy.walletRegistry?.agents ?? []).filter((wallet) => wallet.id === id);
    const assignments = (request.requestedAssignments ?? []).filter((item) => item.agentId === id);
    if (wallets.length !== 1 || assignments.length !== 1 || wallets[0].status !== 'unassigned') {
      throw new Error('Agent registry is missing, duplicated, frozen, or already assigned');
    }
  }
  if (!isSolanaPublicKey(primaryAddress))
    throw new Error('primary-codex-address must be a public Solana address');
  if (!isSolanaPublicKey(implementationAddress)) {
    throw new Error('implementation-agent-address must be a public Solana address');
  }
  if (primaryAddress === implementationAddress) {
    throw new Error('source and recipient agent addresses must be different');
  }
  if (!isSolanaPublicKey(feeRentPayer)) {
    throw new Error('fee-rent-payer must be a public Solana wallet address');
  }
  if (
    policy.network?.liveExecutionEnabled !== false ||
    queue.liveExecutionEnabled !== false ||
    policy.transactionPolicy?.realAssetMovementEnabled !== false ||
    queue.realAssetMovement !== false
  ) {
    throw new Error('wallet assignment apply refuses to run while live execution is enabled');
  }

  const assignmentByAgent = new Map([
    ['primary-codex', primaryAddress],
    ['implementation-agent', implementationAddress]
  ]);

  const nextRequest = structuredClone(request);
  nextRequest.status = 'applied-awaiting-simulation';
  nextRequest.feeRentPayer = feeRentPayer;
  nextRequest.appliedAtUtc = new Date().toISOString();
  nextRequest.nextAction =
    'Run a non-signing settlement simulation and record ATA, fee, rent, mint, decimals, and memo checks before requesting separate signing approval.';
  nextRequest.requestedAssignments = nextRequest.requestedAssignments.map((assignment) => {
    const publicKey = assignmentByAgent.get(assignment.agentId);
    return publicKey
      ? {
          ...assignment,
          publicKey,
          status: 'assigned-awaiting-simulation'
        }
      : assignment;
  });

  const nextPolicy = structuredClone(policy);
  nextPolicy.walletRegistry.status = 'partially-assigned-awaiting-simulation';
  nextPolicy.walletRegistry.agents = nextPolicy.walletRegistry.agents.map((wallet) => {
    const publicKey = assignmentByAgent.get(wallet.id);
    return publicKey
      ? {
          ...wallet,
          publicKey,
          status: 'assigned',
          assignedBy: 'executive-chairman',
          assignmentSource: REQUEST_PATH,
          assignedAtUtc: nextRequest.appliedAtUtc
        }
      : wallet;
  });
  nextPolicy.nextAction =
    'Run a non-signing simulation for agent-sata-onchain-proposal-2026-10-13-001 before any signing approval.';

  const nextQueue = structuredClone(queue);
  nextQueue.status = 'draft-wallets-assigned-awaiting-simulation';
  nextQueue.proposals = nextQueue.proposals.map((candidate) => {
    if (candidate.id !== request.settlementProposalId) return candidate;
    return {
      ...candidate,
      status: 'draft-wallets-assigned-awaiting-simulation',
      sourcePublicKey: primaryAddress,
      recipientPublicKey: implementationAddress,
      feeRentPayer,
      blockers: [
        'preflight simulation has not been run',
        'associated token account behavior has not been recorded',
        'chairman signing approval has not been recorded',
        'live execution is disabled'
      ],
      requiredBeforeSimulation: [
        'confirm recipient associated token account behavior',
        'estimate SOL fee and rent impact',
        'verify SATA mint, token program, and decimals',
        'verify memo content hash still matches proposal fields'
      ]
    };
  });
  nextQueue.nextAction =
    'Run a non-signing simulation for agent-sata-onchain-proposal-2026-10-13-001; do not sign or submit.';

  // Preserve recovery evidence before changing multiple files. An interrupted
  // update blocks subsequent applies instead of silently accepting partial state.
  const recoveryPath = join('use_case', '.wallet-assignment-recovery.json');
  await writeFile(recoveryPath, JSON.stringify({ request, policy, queue }), { flag: 'wx' });
  await writeJson(REQUEST_PATH, nextRequest);
  await writeJson(POLICY_PATH, nextPolicy);
  await writeJson(QUEUE_PATH, nextQueue);
  await unlink(recoveryPath);

  return {
    status: 'applied-awaiting-simulation',
    updated: [REQUEST_PATH, POLICY_PATH, QUEUE_PATH],
    nextAction: nextQueue.nextAction,
    boundary:
      'Only public address records were updated. No signing material was read or stored, and no transaction was created, signed, submitted, or broadcast.'
  };
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (Object.hasOwn(parsed, key)) throw new Error('Duplicate argument');
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function assertSafeApplyArgs(args) {
  const allowed = new Set([
    'primary-codex-address',
    'implementation-agent-address',
    'fee-rent-payer',
    'confirm-chairman-approval'
  ]);
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw new Error(`Unsupported argument --${key}`);
    if (/private|secret|seed|keypair|mnemonic/i.test(key)) {
      throw new Error(`Refusing sensitive argument --${key}`);
    }
  }
}

function findSettlementProposal(queue, request) {
  return (queue.proposals ?? []).find((proposal) => proposal.id === request.settlementProposalId);
}

export function isSolanaPublicKey(value) {
  if (typeof value !== 'string' || !SOLANA_PUBLIC_KEY_PATTERN.test(value)) return false;
  try {
    const key = new PublicKey(value);
    return (
      key.toBase58() === value &&
      PublicKey.isOnCurve(key.toBytes()) &&
      value !== '11111111111111111111111111111111'
    );
  } catch {
    return false;
  }
}

async function readState() {
  const [request, policy, queue, executiveQueue] = await Promise.all([
    readJson(REQUEST_PATH),
    readJson(POLICY_PATH),
    readJson(QUEUE_PATH),
    readJson(APPROVAL_QUEUE_PATH)
  ]);
  const approvalItem = (executiveQueue.items ?? []).find(
    (item) => item.id === request.approvalItemId
  );
  return { request, policy, queue, approvalItem };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}
