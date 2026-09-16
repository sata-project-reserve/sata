# SATA Reserve Token Social Dispatch Brief

Generated: 2026-09-16T22:56:23.606Z
Account: @SATAReserve

## Boundary
This brief coordinates manual social dispatch only. It does not publish posts, approve posts, contact prospects, request payment, grant tokens, move assets, or record state.

## Evidence Intake
https://github.com/sata-project-reserve/sata/issues/new?template=social-publish-evidence.yml

## Queue Counts
Approved: 8
Ready for review: 2
Published: 1
Hold: 1
Live posting enabled: false

## Ready Manual Posts
Batch: 5 of 8 approved posts. Backlog after this batch: 3.

### transparency-service-offer
Type: revenue
Priority: tier 1 - approved revenue-service offer
Approved by: owner
Approval role: not recorded
Approved at: 2026-08-26T12:45:00Z
Approved content SHA-256: 4f846ec83919ae496dbf55643f433fdcb7615ae3055c6c71b73d0faafc544448
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, move assets, or treat replies as invoice-ready without evidence review.

Social publish evidence issue-body command:

```sh
node scripts/social-publish-evidence-agent.mjs render-template --post transparency-service-offer --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4f846ec83919ae496dbf55643f433fdcb7615ae3055c6c71b73d0faafc544448
```

```text
SATA offers $249 Transparency Audits: authority, supply, LP lock/ownership, reserve claims, risk disclosures, and JSON.

Reserve work is not a redemption promise. Locked LP must be verified.

https://sata-project-reserve.github.io/sata/services/transparency-audit
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post transparency-service-offer --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4f846ec83919ae496dbf55643f433fdcb7615ae3055c6c71b73d0faafc544448
```

After publication is recorded, triage replies from this exact source:

```sh
node scripts/inbound-reply-triage-agent.mjs markdown --sourceType published-social-reply --sourceId transparency-service-offer --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"
```

Invoice-request reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId transparency-service-offer --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "invoice-request-needs-chairman-review" --customerAskedForInvoice true
```

Intake reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId transparency-service-offer --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "needs-intake-fields" --customerAskedForInvoice false
```

### service-upgrade-path
Type: revenue
Priority: tier 1 - approved revenue-service offer
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:49.400Z
Approved content SHA-256: b512cd178e14f77e119b9f1ee5fbe4dcd77bee6e688b749a771f1ea9868c2a09
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, move assets, or treat replies as invoice-ready without evidence review.

Social publish evidence issue-body command:

```sh
node scripts/social-publish-evidence-agent.mjs render-template --post service-upgrade-path --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash b512cd178e14f77e119b9f1ee5fbe4dcd77bee6e688b749a771f1ea9868c2a09
```

```text
SATA service path: $249 Transparency Audit first. If a team wants implementation help, scope can move to report setup or $4999/month monitoring.

No market outcome, volume, or buyer-demand claims.

https://sata-project-reserve.github.io/sata/services/transparency-audit
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post service-upgrade-path --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash b512cd178e14f77e119b9f1ee5fbe4dcd77bee6e688b749a771f1ea9868c2a09
```

After publication is recorded, triage replies from this exact source:

```sh
node scripts/inbound-reply-triage-agent.mjs markdown --sourceType published-social-reply --sourceId service-upgrade-path --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"
```

Invoice-request reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId service-upgrade-path --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "invoice-request-needs-chairman-review" --customerAskedForInvoice true
```

Intake reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId service-upgrade-path --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "needs-intake-fields" --customerAskedForInvoice false
```

### quick-project-status-20260915
Type: transparency
Priority: tier 3 - approved status post with revenue-first context
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-15T11:25:37.689Z
Approved content SHA-256: a3ad3c4d30be88d9f57feb1e33abbc08a9ee34be937034a80931bed2cf968b15
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, move assets, or treat replies as invoice-ready without evidence review.

Social publish evidence issue-body command:

```sh
node scripts/social-publish-evidence-agent.mjs render-template --post quick-project-status-20260915 --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash a3ad3c4d30be88d9f57feb1e33abbc08a9ee34be937034a80931bed2cf968b15
```

```text
Quick SATA status:
- 500,000 sats reserve disclosed
- Mint/freeze authorities revoked
- Locked LP verified
- Revenue First: $249 Transparency Audits

Reserve is not a redemption promise.

https://sata-project-reserve.github.io/sata/transparency
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post quick-project-status-20260915 --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash a3ad3c4d30be88d9f57feb1e33abbc08a9ee34be937034a80931bed2cf968b15
```

After publication is recorded, triage replies from this exact source:

```sh
node scripts/inbound-reply-triage-agent.mjs markdown --sourceType published-social-reply --sourceId quick-project-status-20260915 --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"
```

Invoice-request reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId quick-project-status-20260915 --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "invoice-request-needs-chairman-review" --customerAskedForInvoice true
```

Intake reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId quick-project-status-20260915 --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "needs-intake-fields" --customerAskedForInvoice false
```

### btc-reserve-first-tranche
Type: transparency
Priority: tier 4 - approved transparency proof
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:29.101Z
Approved content SHA-256: 4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, move assets, or treat replies as invoice-ready without evidence review.

Social publish evidence issue-body command:

```sh
node scripts/social-publish-evidence-agent.mjs render-template --post btc-reserve-first-tranche --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e
```

```text
SATA has a dedicated Bitcoin reserve address with signed address-control proof. Current first tranche: 500,000 sats.

The BTC reserve is not a redemption promise or guaranteed price floor.

https://sata-project-reserve.github.io/sata/transparency
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post btc-reserve-first-tranche --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 4789767cdadc7ca0bee4858b4976bc36d8fdffffb28b6e19862d4116a732252e
```

After publication is recorded, triage replies from this exact source:

```sh
node scripts/inbound-reply-triage-agent.mjs markdown --sourceType published-social-reply --sourceId btc-reserve-first-tranche --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"
```

Invoice-request reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId btc-reserve-first-tranche --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "invoice-request-needs-chairman-review" --customerAskedForInvoice true
```

Intake reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId btc-reserve-first-tranche --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "needs-intake-fields" --customerAskedForInvoice false
```

### authority-revoked
Type: education
Priority: tier 4 - approved transparency proof
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:34.639Z
Approved content SHA-256: 5210756b4a42acb586bdde80a314fc11d245e1014b5fbed4ad766d06eb134d29
Publish the exact approved text manually, capture the live post URL and evidence, then record the publication with the approved SHA-256.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, move assets, or treat replies as invoice-ready without evidence review.

Social publish evidence issue-body command:

```sh
node scripts/social-publish-evidence-agent.mjs render-template --post authority-revoked --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 5210756b4a42acb586bdde80a314fc11d245e1014b5fbed4ad766d06eb134d29
```

```text
SATA mint and freeze authorities are revoked on Solana mainnet. That means no hidden minting path and no freeze authority when the public checks are passing.

Verify from the public report:
https://sata-project-reserve.github.io/sata/transparency
```

After manual publication, record the live post evidence:

```sh
npm run social:agent -- record-published --post authority-revoked --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 5210756b4a42acb586bdde80a314fc11d245e1014b5fbed4ad766d06eb134d29
```

After publication is recorded, triage replies from this exact source:

```sh
node scripts/inbound-reply-triage-agent.mjs markdown --sourceType published-social-reply --sourceId authority-revoked --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"
```

Invoice-request reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId authority-revoked --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "invoice-request-needs-chairman-review" --customerAskedForInvoice true
```

Intake reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId authority-revoked --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "needs-intake-fields" --customerAskedForInvoice false
```

## Next Action
Publish approved post transparency-service-offer exactly as written, then record the live URL with evidence.
