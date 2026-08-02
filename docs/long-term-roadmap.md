# SATA Long-Term Roadmap

## North Star

SATA should become a transparent Bitcoin-aligned community token on Solana with verifiable reserves, locked liquidity, revoked token authorities, public reporting, and useful products or services.

The long-term treasury target is `10 BTC`, equal to `1,000,000,000 sats`. The project narrative should be framed as helping speculative token traders learn to think in sats, reserves, custody, and proof over time. It must not be framed as a guaranteed conversion, redemption path, or promise that the market will price SATA at any specific level.

The phrase `1 SATA = 1 sat` can be used internally as an aspirational milestone, but it must not be promoted as a guaranteed price target, redemption claim, or promise of appreciation. There are two separate milestones:

- Treasury milestone: public BTC reserves reach `1 sat per 1 SATA`. For the current `1,000,000,000 SATA` supply, this requires `1,000,000,000 sats` (`10 BTC`).
- Market milestone: independent buyers and sellers organically quote SATA around `1 sat`. This can only be earned through liquidity, trust, utility, and demand. It must not be manufactured.

## Principles

- No hidden minting.
- No hidden taxes.
- No blacklist, honeypot, or sell-block logic.
- No fake volume.
- No undisclosed paid promotion.
- No claim of locked liquidity unless the lock is verified on-chain.
- No claim of BTC backing until the reserve address and signed proof are published.
- No promise that BTC reserves create a price floor unless redemption rules are legally and technically implemented.

## Phase 0: Launch Integrity

Status: mostly complete.

Deliverables:

- SATA mint created on Solana mainnet.
- Fixed supply minted.
- Mint authority revoked.
- Freeze authority revoked.
- Metaplex metadata created.
- Raydium CPMM SATA/WSOL pool created.
- Initial LP locked through Raydium Burn & Earn.
- GMGN discoverability and trading path confirmed by normal user interface.

Acceptance criteria:

- Launch manifest records mint, pool, metadata, authority state, LP lock transaction, and explorer links.
- Public docs distinguish token authority revocation from liquidity locking.
- Any later liquidity addition is locked separately if the project intends to describe it as locked.

## Phase 1: Proof Of Reserve And Transparency

Goal: make SATA auditable before making broader claims.

Deliverables:

- Dedicated Bitcoin reserve address.
- Signed Bitcoin message proving control of the reserve address.
- Public transparency page with:
  - SATA mint.
  - Raydium pool.
  - LP lock transaction.
  - Token authority status.
  - Bitcoin reserve address.
  - Reserve ratio.
  - Report timestamp.
- Twice-daily transparency report, with a daily cadence available if operating overhead becomes too high.
- Public changelog for treasury movements.

Acceptance criteria:

- Anyone can verify the BTC reserve balance without trusting the project.
- Anyone can verify Solana token supply and LP lock status from public chain data.
- Reports avoid price promises and use exact integer reserve math.

## Phase 2: Product And Community Utility

Goal: create reasons to care about SATA that do not depend on speculation.

Candidate products:

- Bitcoin reserve dashboard for SATA.
- Sats education tools.
- Public Solana token safety checklist generator.
- Merchant tipping or community contribution flow.
- Open-source launch transparency templates for other communities.
- SATA-branded goods sold for BTC/SOL/SATA with public treasury allocation rules.

Acceptance criteria:

- At least one shipped product is useful without needing the token price to rise.
- Revenue or donations have a published allocation policy.
- Any reserve growth from revenue is publicly reported.

## Phase 3: Treasury Growth

Goal: grow BTC reserves through legitimate inflows, not market manipulation.

Potential inflows:

- Product revenue.
- Donations.
- Voluntary community contributions.
- Merchandise margin.
- Public grants.

Policy:

- Reserve growth should be reported in sats.
- Reserve ratio should be reported as sats per SATA and SATA per sat.
- Treasury buys, if ever used, must be disclosed and must not be framed as guaranteed price support.

Milestones:

- `500,000 sats`: first reserve tranche.
- `1,000,000 sats`: early reserve milestone.
- `10,000,000 sats`: 1% of the `1 sat per SATA` treasury milestone.
- `100,000,000 sats`: 10% of the milestone.
- `1,000,000,000 sats`: full treasury ratio of `1 sat per SATA`.

## Phase 4: Governance And Stewardship

Goal: reduce single-person trust.

Deliverables:

- Published operating charter.
- Multisig reserve custody target.
- Public signer policy.
- Treasury spending categories.
- Conflict-of-interest disclosure.
- Incident response policy.

Acceptance criteria:

- No reserve movement can be confused with a private withdrawal.
- Community can distinguish treasury custody, LP custody, and token ownership.

## Phase 5: Market Readiness And Distribution Quality

Goal: improve healthy distribution and trading conditions without artificial activity.

Deliverables:

- Public holder distribution dashboard.
- Liquidity depth reporting.
- Slippage reporting for standard trade sizes.
- GMGN/Raydium route checks.
- Independent market-data links.
- Clear disclosure that liquidity can still be thin and volatile.

Prohibited:

- Coordinated wash trading.
- Multiple insider wallets pretending to be organic holders.
- Paid trend manipulation.
- Hidden liquidity removal.

Acceptance criteria:

- Buy and sell routes remain available.
- Pool reserves are nonzero and monitored.
- Any unlocked LP is either disclosed as removable or separately locked.

## Immediate Next Build

The next engineering sprint should build the public transparency layer:

1. Keep improving the `transparency` module with BTC reserve inputs and exact reserve metrics.
2. Keep the public report generator current as it combines:
   - Solana launch manifest.
   - Raydium pool and LP lock verification.
   - BTC reserve proof.
   - Reserve ratio.
3. Add a more polished static transparency page suitable for sharing beyond the raw JSON/Markdown report.
4. Expand tests for reserve math, report redaction, and lock-status wording.
5. Run the scheduled report every 12 hours once the public repository and GitHub Pages deployment are enabled.

The project should not run paid promotion until this transparency layer is complete.
