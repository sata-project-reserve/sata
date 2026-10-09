# Bitcoin Treasury Policy

## Purpose

SATA should use Bitcoin reserves as a transparency primitive, not as a marketing trick. The reserve can show long-term alignment with Bitcoin and discipline around public reporting, but it must not be described as a guaranteed price floor, redemption promise, yield product, or investment contract.

## Current Reserve Math

Long-term reserve target: `1,000,000,000 sats` (`10 BTC`).

First Bitcoin reserve tranche: `500,000 sats` (`0.005 BTC`).

Current reported SATA supply: `999,996,853.34994591 SATA`.

Exact reserve ratio:

- `1 SATA ~= 1/2000 sat` at the first `500,000 sats` tranche.
- `1 sat ~= 2,000 SATA` at the first `500,000 sats` tranche.
- Progress toward a treasury ratio of `1 sat per 1 SATA`: about `0.05%`.
- Total reserve needed for `1 sat per 1 SATA`: `999,996,854 sats` (`9.99996854 BTC`).
- Additional reserve needed from the first tranche: `999,496,854 sats`.
- Additional reserve needed to reach the full `1,000,000,000 sats` milestone: `999,500,000 sats` (`9.995 BTC`).

This is a public treasury reserve ratio. It is not the same as a market quote, and it is not a redemption guarantee unless a separate legally reviewed redemption mechanism is created.

The 1,000,000,000 sats milestone is an operating treasury target. It is not a promise that market price, liquidity, or redemption value will converge to any amount.

## Required Reserve Controls

Before making any public reserve claim, the project must complete all of these:

1. Create a dedicated Bitcoin reserve address.
2. Move the reserve sats into that address.
3. Sign a public message from the reserve address:

   `SATA Bitcoin reserve address for Solana mint A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH. No redemption promise. Snapshot UTC: <timestamp>.`

4. Publish the address, message, and signature.
5. Archive the first proof in the launch report.
6. Add a recurring reserve report cadence.

## Reporting Rules

Every public reserve report must include:

- Bitcoin reserve address.
- BTC and satoshi balance.
- SATA mint address.
- SATA supply.
- Reserve ratio in sats per SATA.
- Reserve ratio in SATA per sat.
- Date and UTC timestamp.
- Whether the reserve is verified by address balance only or by address balance plus signed message.
- Clear statement that liquidity, market price, and treasury reserves are separate.

## Spending Policy

Default policy: no treasury spending without a public note explaining the purpose, amount, destination category, and expected benefit to SATA holders/community.

Allowed categories:

- Infrastructure.
- Security review.
- Public goods and educational material.
- Product development.
- Community grants approved through a transparent process.

Disallowed categories:

- Wash trading or artificial volume.
- Paying undisclosed promoters.
- Hidden market support.
- Private extraction by insiders.
- Any claim that treasury spending guarantees price appreciation.
- Hidden selling into buyers or undisclosed project asset conversion.

## Custody Roadmap

Phase 1 can use a dedicated single reserve address for speed, but the target state should be multisig custody with public signer identities or clearly defined signer roles.

The project should not mix personal Bitcoin funds with the SATA reserve address.

## Reserve Growth Operating Process

Use `public/reserve-growth-plan.json` as the machine-readable reserve growth plan.

Use `npm run ops:reserve-plan` to view current progress, remaining sats, next milestone, allowed funding routes, prohibited routes, and open treasury approvals.

Use `npm run ops:reserve-draft-next-tranche` to prepare the next milestone reserve proposal for Executive Chairman review.

Every reserve growth action must have:

- Executive Chairman approval;
- source-of-funds category;
- amount;
- destination reserve address;
- public caveat language;
- post-execution evidence.

## Reserve Address Migration

A reserve address migration is a treasury action, even when the intent is only temporary custody cleanup. The published reserve address must not be replaced in the public report until the migration transaction is broadcast, confirmed, and evidence is recorded.

For a manual sweep:

- The Executive Chairman chooses the destination address and fee rate in the wallet.
- Agents must not hold keys, request seed phrases, sign transactions, broadcast transactions, or operate wallet software.
- If the instruction is `send max`, the destination will receive the current UTXO value minus the miner fee unless another wallet input funds the fee.
- The public report must continue to show the old address until the new address has confirmed balance evidence.

Required post-execution evidence before changing the published reserve address:

- old reserve address;
- new reserve address;
- Bitcoin transaction id;
- amount received by the new address;
- fee rate or wallet fee setting used;
- confirmation count;
- whether the new address has signed address-control proof;
- explicit note that the migration is not a redemption promise, price floor, yield product, or market-support action.
