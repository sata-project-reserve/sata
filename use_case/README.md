# Private Agent SATA Use Case

This folder tracks a private internal use case for SATA as an accounting metric for agent work across `G:\` and approved external workspaces.

In this use case, SATA is not an on-chain transfer, not a public reserve transaction, not a market trade, and not a claim on real custody. It is a private work-credit ledger used to measure how agents spend compute, delegate tasks, review evidence, and conserve tokens.

## Purpose

The goal is to make agent operations more efficient. When agents interact with each other, the interaction should have an associated private SATA accounting transaction so the project can measure whether the work created enough value for the compute budget it consumed.

The initial compute budget source is the GitHub Pro subscription and any other chairman-approved agent compute budget. Agent SATA is used to price internal work against that budget.

## Engineering Economy Architecture

The private engineering economy has four layers:

- Engineering Mind: strategy, task allocation, verification, learning, and governance.
- Specialized agents: GMGN Agent, Micronaut Agent, Career Agent, and future domain agents with private SATA wallets.
- SATA_RESERVE: compute treasury, private accounting ledger, budget allocation, settlement, and evidence retention.
- Compute providers: Codex sessions, model inference, tool execution, testing, and other measurable compute inputs.

The machine-readable architecture is in `use_case/engineering-economy-architecture.json`.

## On-Chain Settlement Readiness

The private ledger remains the default operating model. On-chain agent SATA settlement is a separate approval layer tracked in `use_case/on-chain-agent-settlement-policy.json` and `use_case/on-chain-agent-settlement-queue.json`.

That layer exists so agents can eventually settle selected evidenced ledger entries on Solana, but it is currently planning-only. It does not create, sign, submit, or retry Solana transactions. It requires chairman-approved public Solana addresses, idempotency checks, memo content hashes, preflight simulation, fee/rent disclosure, finalized confirmation, and explicit Executive Chairman approval before any real SATA movement can be treated as settled.

## Operating Model

1. A task is opened with a clear objective, scope, and evidence requirement.
2. The agent receiving the task quotes the expected SATA cost.
3. The requesting agent accepts or rejects the quote before delegated work begins.
4. The receiving agent completes work and attaches evidence.
5. A private SATA transaction is recorded for the work, review, bonus, refund, or penalty.
6. The final record tracks estimated tokens, actual tokens where available, reusable artifacts, and rework.

## What Counts As Value

- A completed task with retained evidence.
- A reusable artifact that reduces future token use.
- A verified review that catches a real defect.
- A concise handoff that lets another agent continue without rediscovering context.
- A workflow change that measurably lowers repeated prompt or search cost.

## Stop Rules

- Do not use this ledger to move real SATA, SOL, BTC, USD, or any other asset.
- Do not connect this use case to wallets, private keys, seed phrases, brokers, exchanges, or signing flows.
- Do not make market value, redemption, yield, or price claims from agent SATA balances.
- Do not publish this private-use-case ledger without explicit chairman approval.
- Do not settle agent work that lacks evidence, exceeds approved scope, or duplicates existing work without a stated reason.

## Edge Cases

- Failed work should receive a refund or rework penalty instead of a normal completion payment.
- Duplicate work should be penalized unless the duplicate run was explicitly requested for verification.
- High-token work should require a quote that explains why reuse, search, or existing artifacts were insufficient.
- Cross-project work must name the source workspace, target workspace, and the allowed evidence boundary.
- Financial, wallet, broker, and external-write actions still require the existing chairman approval controls and are outside this private accounting model.
