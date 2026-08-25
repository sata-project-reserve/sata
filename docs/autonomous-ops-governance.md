# SATA Autonomous Ops Governance

SATA can use automation for reporting, social operations, monitoring, and drafting. Automation must not take custody of project assets or make discretionary treasury, liquidity, or trading decisions.

## Operating Principle

Autonomy is useful for repeatable public operations:

- verify public state;
- publish factual updates;
- monitor questions and issues;
- prepare partner intake;
- maintain documentation and runbooks.

Autonomy is not appropriate for private keys, reserve custody, discretionary trading, undisclosed promotion, or legal commitments.

Jean Bilong is the Executive Chairman. Agents operate as staff: they prepare work, verify facts, monitor public signals, draft proposals, and maintain records. The Executive Chairman approves final transactions, project proposals, treasury movement, liquidity changes, paid promotion, token compensation, partnerships, and public commitments.

## Operating Units

### Transparency

Owner: GitHub Actions automation.

Responsibilities:

- generate the public transparency report;
- verify mint and freeze authority status;
- verify Raydium liquidity and LP lock status;
- verify BTC reserve reporting;
- deploy the static transparency page.

Authority limits:

- read-only chain and public API access;
- no wallet signatures;
- no movement of BTC, SOL, SATA, or LP tokens.

### Social

Owner: X social agent plus human approval.

Responsibilities:

- draft factual posts from the latest transparency report;
- publish only repository-approved queue items when automation is enabled;
- record post URLs and monitoring state;
- avoid hype, price claims, coordinated-buy language, and undisclosed paid promotion.

Authority limits:

- can post only with an approved queue item and X API credentials;
- cannot approve its own posts;
- cannot negotiate paid promotions or token grants.

### Treasury

Owner: human signer or future multisig.

Responsibilities:

- preserve the BTC reserve;
- publish reserve movements before or immediately after execution;
- work toward multisig custody;
- maintain the long-term 1,000,000,000 sats target as a treasury milestone.

Authority limits:

- no autonomous agent may hold seed phrases, private keys, or signing authority;
- no treasury spending without a public note explaining amount, purpose, and destination category;
- no use of treasury for wash trading, artificial volume, undisclosed promotion, or hidden market support.

### Liquidity

Owner: human signer or future governance process.

Responsibilities:

- maintain factual liquidity disclosures;
- verify LP locks;
- disclose owner unlocked LP;
- prepare liquidity changes as signed transaction previews.

Authority limits:

- no autonomous liquidity removal;
- no market-making promises;
- no hidden selling into buyers;
- no coordinated trading campaigns.

### Partner Intake

Owner: human approval with agent-prepared checklist.

Responsibilities:

- require disclosure policy from any promoter;
- require exact draft before publication;
- require public paid or token-compensated disclosure;
- pay only after deliverable is live and unchanged;
- keep records of compensation, post URL, and terms.

Authority limits:

- no undisclosed paid promotion;
- no price predictions, guaranteed results, or investor targeting claims;
- no token grants without public disclosure and approval.

## Near-Term Setup

1. Keep the transparency workflow green.
2. Enable the X social agent with approved-only automation.
3. Keep `@SATAReserve` bio and pinned post aligned with the transparency page.
4. Publish one factual post only when there is real news or a useful explanation.
5. Move custody toward multisig before the reserve grows materially.
6. Maintain a public register for treasury, liquidity, and paid promotion decisions.
7. Use `public/executive-approval-queue.json` as the public approval queue for agent-prepared work.

## Required Human Gates

Human approval is always required for:

- BTC reserve movement;
- SOL, SATA, or LP token movement;
- liquidity addition, removal, burn, or lock;
- token grants;
- paid promotion;
- partnership claims;
- legal, tax, or investment interpretation;
- wallet migration;
- security incidents.

The approval flow is documented in `docs/executive-approval-runbook.md`. Run `npm run ops:plan` to view items awaiting chairman review and `npm run ops:check` to validate the queue.

## Public Target Language

Allowed:

`SATA has a long-term treasury milestone of 1,000,000,000 sats. The reserve is a transparency metric, not a redemption promise or guaranteed price floor.`

Not allowed:

`SATA will reach a price backed by 1,000,000,000 sats.`

`Buy now before the reserve grows.`

`The dev wallet will sell into buyers and recycle proceeds.`

`1 SATA will equal 1 sat.`
