# SATA Reserve Token Social Dispatch Brief

Generated: 2026-10-10T05:53:18.950Z
Account: @SATAReserve

## Boundary
This brief coordinates manual social dispatch only. It does not publish posts, approve posts, contact prospects, request payment, grant tokens, move assets, or record state.

## Evidence Intake
https://github.com/sata-project-reserve/sata/issues/new?template=social-publish-evidence.yml

## Queue Counts
Approved: 5
Ready for review: 2
Published: 1
Hold: 4
Live posting enabled: false

## Ready Manual Posts
Batch: 5 of 5 approved posts. Backlog after this batch: 0.

### transparency-service-offer
Type: revenue
Priority: tier 1 - approved revenue-service offer
Approved by: owner
Approval role: not recorded
Approved at: 2026-08-26T12:45:00Z
Approved content SHA-256: 4f846ec83919ae496dbf55643f433fdcb7615ae3055c6c71b73d0faafc544448
X compose URL: https://x.com/intent/tweet?text=SATA%20offers%20%24249%20Transparency%20Audits%3A%20authority%2C%20supply%2C%20LP%20lock%2Fownership%2C%20reserve%20claims%2C%20risk%20disclosures%2C%20and%20JSON.%0A%0AReserve%20work%20is%20not%20a%20redemption%20promise.%20Locked%20LP%20must%20be%20verified.%0A%0Ahttps%3A%2F%2Fsata-project-reserve.github.io%2Fsata%2Fservices%2Ftransparency-audit
Publish the exact approved text manually, submit the live post evidence issue, run the evidence review, then record only with the verified hash-bound command.
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

After manual publication, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:social-publish-evidence-plan
```

Record-published command:

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
X compose URL: https://x.com/intent/tweet?text=SATA%20service%20path%3A%20%24249%20Transparency%20Audit%20first.%20If%20a%20team%20wants%20implementation%20help%2C%20scope%20can%20move%20to%20report%20setup%20or%20%244999%2Fmonth%20monitoring.%0A%0ANo%20market%20outcome%2C%20volume%2C%20or%20buyer-demand%20claims.%0A%0Ahttps%3A%2F%2Fsata-project-reserve.github.io%2Fsata%2Fservices%2Ftransparency-audit
Publish the exact approved text manually, submit the live post evidence issue, run the evidence review, then record only with the verified hash-bound command.
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

After manual publication, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:social-publish-evidence-plan
```

Record-published command:

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

### authority-revoked
Type: education
Priority: tier 4 - approved transparency proof
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:34.639Z
Approved content SHA-256: 5210756b4a42acb586bdde80a314fc11d245e1014b5fbed4ad766d06eb134d29
X compose URL: https://x.com/intent/tweet?text=SATA%20mint%20and%20freeze%20authorities%20are%20revoked%20on%20Solana%20mainnet.%20That%20means%20no%20hidden%20minting%20path%20and%20no%20freeze%20authority%20when%20the%20public%20checks%20are%20passing.%0A%0AVerify%20from%20the%20public%20report%3A%0Ahttps%3A%2F%2Fsata-project-reserve.github.io%2Fsata%2Ftransparency
Publish the exact approved text manually, submit the live post evidence issue, run the evidence review, then record only with the verified hash-bound command.
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

After manual publication, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:social-publish-evidence-plan
```

Record-published command:

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

### liquidity-disclosure
Type: transparency
Priority: tier 4 - approved transparency proof
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:39.845Z
Approved content SHA-256: 79880b681cebb9df659a3c5a96e6042de033949eb95c7886c8a49916b7079368
X compose URL: https://x.com/intent/tweet?text=The%20Raydium%20SATA%2FWSOL%20pool%20is%20live.%20Initial%20Burn%20%26%20Earn%20LP%20lock%20is%20verified%2C%20and%20owner-held%20unlocked%20LP%20is%20disclosed%20separately.%0A%0AUnlocked%20LP%20remains%20removable%20unless%20separately%20locked%20and%20verified.%0A%0Ahttps%3A%2F%2Fsata-project-reserve.github.io%2Fsata%2Ftransparency
Publish the exact approved text manually, submit the live post evidence issue, run the evidence review, then record only with the verified hash-bound command.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, move assets, or treat replies as invoice-ready without evidence review.

Social publish evidence issue-body command:

```sh
node scripts/social-publish-evidence-agent.mjs render-template --post liquidity-disclosure --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 79880b681cebb9df659a3c5a96e6042de033949eb95c7886c8a49916b7079368
```

```text
The Raydium SATA/WSOL pool is live. Initial Burn & Earn LP lock is verified, and owner-held unlocked LP is disclosed separately.

Unlocked LP remains removable unless separately locked and verified.

https://sata-project-reserve.github.io/sata/transparency
```

After manual publication, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:social-publish-evidence-plan
```

Record-published command:

```sh
npm run social:agent -- record-published --post liquidity-disclosure --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash 79880b681cebb9df659a3c5a96e6042de033949eb95c7886c8a49916b7079368
```

After publication is recorded, triage replies from this exact source:

```sh
node scripts/inbound-reply-triage-agent.mjs markdown --sourceType published-social-reply --sourceId liquidity-disclosure --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"
```

Invoice-request reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId liquidity-disclosure --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "invoice-request-needs-chairman-review" --customerAskedForInvoice true
```

Intake reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId liquidity-disclosure --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "needs-intake-fields" --customerAskedForInvoice false
```

### ten-btc-target
Type: roadmap
Priority: tier 9 - approved backlog order
Approved by: owner
Approval role: executive-chairman
Approved at: 2026-09-03T21:48:44.990Z
Approved content SHA-256: ef3cfad6266b194c678c140adacd3d5aab8454459e0a74281c8941bac107a268
X compose URL: https://x.com/intent/tweet?text=Long-term%20SATA%20treasury%20target%3A%2010%20BTC.%0A%0AThe%20point%20is%20to%20move%20attention%20toward%20sats%2C%20custody%2C%20reserves%2C%20and%20proof%20over%20time.%20This%20is%20not%20a%20redemption%20path%2C%20price%20target%2C%20or%20market-support%20promise.%0A%0AProof%20over%20promises.
Publish the exact approved text manually, submit the live post evidence issue, run the evidence review, then record only with the verified hash-bound command.
Do not edit the approved text, add claims, publish unapproved posts, approve compensation, request payment, grant tokens, move assets, or treat replies as invoice-ready without evidence review.

Social publish evidence issue-body command:

```sh
node scripts/social-publish-evidence-agent.mjs render-template --post ten-btc-target --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash ef3cfad6266b194c678c140adacd3d5aab8454459e0a74281c8941bac107a268
```

```text
Long-term SATA treasury target: 10 BTC.

The point is to move attention toward sats, custody, reserves, and proof over time. This is not a redemption path, price target, or market-support promise.

Proof over promises.
```

After manual publication, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:social-publish-evidence-plan
```

Record-published command:

```sh
npm run social:agent -- record-published --post ten-btc-target --postUrl "https://x.com/SATAReserve/status/<numeric-id>" --evidence "<live-post-screenshot-or-exported-text>" --publishedAtUtc "<published-at-utc>" --contentHash ef3cfad6266b194c678c140adacd3d5aab8454459e0a74281c8941bac107a268
```

After publication is recorded, triage replies from this exact source:

```sh
node scripts/inbound-reply-triage-agent.mjs markdown --sourceType published-social-reply --sourceId ten-btc-target --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"
```

Invoice-request reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId ten-btc-target --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "invoice-request-needs-chairman-review" --customerAskedForInvoice true
```

Intake reply evidence issue-body command:

```sh
node scripts/inbound-reply-evidence-agent.mjs render-template --sourceType published-social-reply --sourceId ten-btc-target --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>" --classification "needs-intake-fields" --customerAskedForInvoice false
```

## Next Action
Publish approved post transparency-service-offer exactly as written, then submit live URL evidence for review.
