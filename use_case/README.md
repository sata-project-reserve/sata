# Private Agent SATA Use Case

This folder tracks a private internal use case for SATA as an accounting metric for agent work across `G:\` and approved external workspaces.

In this use case, SATA is not an on-chain transfer, not a public reserve transaction, not a market trade, and not a claim on real custody. It is a private work-credit ledger used to measure how agents spend compute, delegate tasks, review evidence, and conserve tokens.

## Purpose

The goal is to make agent operations more efficient. When agents interact with each other, the interaction should have an associated private SATA accounting transaction so the project can measure whether the work created enough value for the compute budget it consumed.

The initial compute budget source is the GitHub Pro subscription and any other chairman-approved agent compute budget. Agent SATA is used to price internal work against that budget.

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
