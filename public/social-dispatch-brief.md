# SATA Reserve Token Social Dispatch Brief

Generated: 2026-09-12T22:17:15.379Z
Account: @SATAReserve

## Boundary
This brief coordinates manual social dispatch only. It does not publish posts, approve posts, contact prospects, request payment, grant tokens, move assets, or record state.

## Evidence Intake
https://github.com/sata-project-reserve/sata/issues/new?template=social-publish-evidence.yml

## Queue Counts
Approved: 7
Ready for review: 2
Published: 1
Hold: 1
Live posting enabled: false

## Ready Manual Posts
Batch: 5 of 7 approved posts. Backlog after this batch: 2.

### btc-reserve-first-tranche
Type: transparency
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:29.101Z
Approved content SHA-256: 4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, or move assets.

```text
SATA has a dedicated Bitcoin reserve address with signed address-control proof. Current first tranche: 500,000 sats.

The BTC reserve is not a redemption promise or guaranteed price floor.

https://sata-project-reserve.github.io/sata/transparency
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post btc-reserve-first-tranche --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e
```

### authority-revoked
Type: education
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:34.639Z
Approved content SHA-256: 5210756b4a42acb586bdde80a314fc11d245e1014b5fbed4ad766d06eb134d29
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, or move assets.

```text
SATA mint and freeze authorities are revoked on Solana mainnet. That means no hidden minting path and no freeze authority when the public checks are passing.

Verify from the public report:
https://sata-project-reserve.github.io/sata/transparency
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post authority-revoked --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 5210756b4a42acb586bdde80a314fc11d245e1014b5fbed4ad766d06eb134d29
```

### liquidity-disclosure
Type: transparency
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:39.845Z
Approved content SHA-256: 79880b681cebb9df659a3c5a96e6042de033949eb95c7886c8a49916b7079368
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, or move assets.

```text
The Raydium SATA/WSOL pool is live. Initial Burn & Earn LP lock is verified, and owner-held unlocked LP is disclosed separately.

Unlocked LP remains removable unless separately locked and verified.

https://sata-project-reserve.github.io/sata/transparency
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post liquidity-disclosure --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 79880b681cebb9df659a3c5a96e6042de033949eb95c7886c8a49916b7079368
```

### ten-btc-target
Type: roadmap
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:44.990Z
Approved content SHA-256: ef3cfad6266b194c678c140adacd3d5aab8454459e0a74281c8941bac107a268
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, or move assets.

```text
Long-term SATA treasury target: 10 BTC.

The point is to move attention toward sats, custody, reserves, and proof over time. This is not a redemption path, price target, or market-support promise.

Proof over promises.
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post ten-btc-target --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash ef3cfad6266b194c678c140adacd3d5aab8454459e0a74281c8941bac107a268
```

### transparency-service-offer
Type: revenue
Approved by: owner
Approval role: not recorded
Approved at: 2026-08-26T12:45:00Z
Approved content SHA-256: 7e53c3087aeb869aeae52efd2e65d39e2f009c5cd3bd89ed663e248183724b08
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, or move assets.

```text
SATA offers $50 transparency audits: authority, liquidity-lock, BTC reserve, and disclosure checks.

The BTC reserve is not a redemption promise or guaranteed price floor. Locked status must be verified.

https://sata-project-reserve.github.io/sata/services/transparency-audit
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post transparency-service-offer --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 7e53c3087aeb869aeae52efd2e65d39e2f009c5cd3bd89ed663e248183724b08
```

## Next Action
Publish approved post btc-reserve-first-tranche exactly as written, then record the live URL with evidence.
