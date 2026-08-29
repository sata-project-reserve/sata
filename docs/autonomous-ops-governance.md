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

### Revenue

Owner: Executive Chairman approval with agent-prepared sales operations.

Responsibilities:

- sell transparency audits, report setup, and proof-dashboard services built from existing SATA infrastructure;
- record scope, deliverables, payment evidence, and allocation evidence;
- prepare revenue-to-reserve and revenue-to-liquidity proposals after funds are received;
- keep the sats-generation ledger current as the primary operating scoreboard;
- prepare exact-sats invoice records for chairman approval before any customer receives payment instructions;
- keep revenue language separate from SATA market-price claims.

Authority limits:

- no agent may receive funds, hold keys, or trade project assets;
- no revenue pitch may promise price, return, redemption, liquidity, or market support;
- no service work may depend on fake engagement, bots, raids, investor lists, or undisclosed paid promotion;
- no received funds may be converted, added to reserve, or added to liquidity without chairman approval.

## Near-Term Setup

1. Keep the transparency workflow green.
2. Enable the X social agent with approved-only automation.
3. Keep `@SATAReserve` bio and pinned post aligned with the transparency page.
4. Publish one factual post only when there is real news or a useful explanation.
5. Move custody toward multisig before the reserve grows materially.
6. Maintain a public register for treasury, liquidity, and paid promotion decisions.
7. Use `public/executive-approval-queue.json` as the public approval queue for agent-prepared work.
8. Use `public/reserve-growth-plan.json` as the machine-readable operating plan for the 1,000,000,000 sats target.
9. Use `public/revenue-operating-plan.json` as the machine-readable plan for revenue-first reserve growth, and `npm run ops:cycle-plan` as the current operating dashboard for the revenue-to-reserve loop.
10. Use `public/sats-generation-ledger.json` as the active pipeline, receipt, and allocation ledger for generating more sats.
11. Use `public/sats-invoice-queue.json` for chairman-approved direct-reserve BTC invoices, `npm run ops:invoice-quote-plan` for exact-sats draft quote preparation, `npm run ops:invoice-payment-plan` for approved customer payment packets, and `npm run ops:receipt-plan` for confirmed receipt allocation proposals.
12. Use `public/sats-prospect-pipeline.json` for evidence-backed service prospecting before outreach, `npm run ops:prospect-candidate-plan` to draft identified prospect records, `npm run ops:prospect-intake-plan` to import prospect-candidate issues, and `npm run ops:outreach-plan` to render manual outreach packets from approved templates.
13. Use `public/transparency-audit-delivery-kit.json` for paid audit intake, scope, delivery gates, and `npm run ops:audit-artifact-plan` for draft artifact preparation.
14. Use `npm run ops:intake-plan` and `npm run ops:intake-check` to convert GitHub issue intake into reviewable draft records.
15. Use the Audit Intake Review workflow and `npm run ops:intake-comment-check` to acknowledge service-intake issues with safe chairman-review comments.

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

Reserve growth is documented in `docs/bitcoin-treasury-policy.md`. Run `npm run ops:reserve-plan` to view progress toward the 1,000,000,000 sats target.

Revenue operations are defined in `public/revenue-operating-plan.json`. Run `npm run ops:revenue-plan` to view the active revenue cycle and `npm run ops:revenue-check` to validate the operating rules.

The revenue cycle dashboard is handled by `scripts/revenue-cycle-agent.mjs`. Run `npm run ops:cycle-plan` to view reserve progress, prospect/invoice/receipt/allocation counts, social readiness, current blockers, and the next action for the revenue-to-reserve loop.

Sats generation is tracked in `public/sats-generation-ledger.json`. Run `npm run ops:sats-plan` to view the current sat-positive pipeline and `npm run ops:sats-check` to validate receipt and allocation records.

Invoice controls are tracked in `public/sats-invoice-queue.json`. Run `npm run ops:invoice-plan` to view invoice templates and `npm run ops:invoice-check` to validate quote and custody rules.

Invoice quote preparation is handled by `scripts/sats-invoice-quote-agent.mjs`. Run `npm run ops:invoice-quote-plan` to view quoting boundaries, and `node scripts/sats-invoice-quote-agent.mjs quote-template --offer transparency-audit --customer "<customer>" --btcUsd "<manual-rate>" --source "<quote-source>"` to draft exact-sats invoice fields for chairman approval.

Approved customer payment packets are handled by `scripts/sats-invoice-payment-packet-agent.mjs`. Run `npm run ops:invoice-payment-plan` to view approved invoices, and `node scripts/sats-invoice-payment-packet-agent.mjs render <invoice-id>` only after the invoice record is `approved-by-chairman` with exact sats and an unexpired quote.

Confirmed receipt allocation proposals are handled by `scripts/sats-receipt-allocation-agent.mjs`. Run `npm run ops:receipt-plan` to view confirmed direct-reserve invoice receipts awaiting allocation records, and `node scripts/sats-receipt-allocation-agent.mjs render <receipt-id>` only after the transaction has been independently confirmed at the published reserve address.

Prospect controls are tracked in `public/sats-prospect-pipeline.json`. Run `npm run ops:prospect-plan` to view buyer segments and daily cadence, and `npm run ops:prospect-check` to validate outreach boundaries.

Prospect candidate drafts are handled by `scripts/sats-prospect-candidate-agent.mjs`. Run `npm run ops:prospect-candidate-plan` for the required fields, and use `node scripts/sats-prospect-candidate-agent.mjs draft --id "<prospect>" --publicProfileUrl "<https-url>" --projectUrl "<https-url>" --observedClaim "<public evidence gap>" --evidence "<https-url-or-note>"` to prepare an identified-stage record before chairman review.

Prospect issue intake is handled by `scripts/prospect-intake-agent.mjs` and `.github/workflows/prospect-intake.yml`. Run `npm run ops:prospect-intake-plan` to view importer boundaries, and use GitHub issues with `prospect-candidate-intake.yml` to submit public-evidence candidates for safe automated review comments.

Manual outreach packets are handled by `scripts/service-outreach-packet-agent.mjs`. Run `npm run ops:outreach-plan` to view approved templates, and `node scripts/service-outreach-packet-agent.mjs render --template transparency-audit-first-contact --prospect "<name>" --profile "<public-url>" --projectUrl "<project-url>"` to draft a compliant message for chairman approval.

Audit delivery controls are tracked in `public/transparency-audit-delivery-kit.json`. Run `npm run ops:delivery-plan` to view intake and delivery rules, and `npm run ops:delivery-check` to validate scope boundaries.

Audit artifact drafts are handled by `scripts/transparency-audit-artifact-agent.mjs`. Run `npm run ops:audit-artifact-plan` to view artifact boundaries, and `node scripts/transparency-audit-artifact-agent.mjs draft-from-issue-json <issue-json-path>` to produce a Markdown draft with required sections and disclosures.

Audit intake conversion is handled by `scripts/audit-intake-agent.mjs`. Run `npm run ops:intake-plan` to view importer boundaries, and `node scripts/audit-intake-agent.mjs draft-from-issue-json <issue-json-path>` to draft prospect, invoice, and delivery records for chairman review.

Audit intake issue comments are handled by `scripts/audit-intake-comment-agent.mjs` and `.github/workflows/audit-intake.yml`. The workflow only runs on issues labelled `service-intake`, upserts one marked review comment, and does not publish payment addresses, exact BTC invoices, or approval claims.

Prospect review packets are handled by `scripts/sats-prospect-review-agent.mjs`. Run `npm run ops:prospect-review-plan` to produce the next bounded chairman review batch from identified prospects, or `node scripts/sats-prospect-review-agent.mjs render` for a Markdown packet. This does not approve outreach, invoices, payment requests, token grants, or commitments.

Prospect stage transitions are handled by `scripts/sats-prospect-stage-agent.mjs`. Run `npm run ops:prospect-stage-plan` to see whether the current approval gate allows advancement, and use `node scripts/sats-prospect-stage-agent.mjs advance --approvalId "<approval-id>" --prospects "<id,id>"` only after the matching approval queue item is `approved-by-chairman`. This can move records to chairman-review only; outreach still needs a later explicit decision.

Prospect-specific outreach packets must use `node scripts/service-outreach-packet-agent.mjs render-approved --prospectId "<id>"`. The approved render path rejects any prospect that is not already `outreach-approved`; generic render output remains a draft helper only.

## Public Target Language

Allowed:

`SATA has a long-term treasury milestone of 1,000,000,000 sats. The reserve is a transparency metric, not a redemption promise or guaranteed price floor.`

Not allowed:

`SATA will reach a price backed by 1,000,000,000 sats.`

`Buy now before the reserve grows.`

`The dev wallet will sell into buyers and recycle proceeds.`

`1 SATA will equal 1 sat.`
