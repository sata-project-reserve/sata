# SATA Reserve Token Reply Conversion Brief

Generated: 2026-09-24T22:24:22.438Z
Reserve: 500000 sats confirmed, 999500000 sats remaining.

## Boundary
This brief records reply-conversion evidence only. It does not contact prospects, approve invoices, send payment instructions, move assets, grant tokens, publish posts, or make commitments.

## Current Counts
Outreach-approved prospects: 30
Ready outreach packets: 30
Sent outreach packets: 0
Contacted prospects: 0
Invoice-requested prospects: 0
Inbound invoice requests: 0

## Next Action
Send outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact exactly as approved, then submit contact evidence and run evidence review before recording.

## Invoice Conversion Sprint
Status: awaiting-manual-contact-send
Objective: Create one chairman-reviewable exact-sats invoice path from the highest-probability revenue evidence without exposing payment instructions early.
Next evidence gate: Send the approved outreach manually and record durable contact evidence.
Planning BTC/USD: 100000
Planning BTC/USD source: operator planning assumption, not a live quote
Reserve allocation: 70%
Current ask reserve impact: 174301 sats
Qualified path reserve impact: 699300 sats
Actual sats rule: Planning only. Record actual sats only after confirmed receipt and chairman-approved allocation.
Stop rule: Stop at the next evidence gate. Do not send payment instructions, approve invoices, count reserve progress, or move assets from this sprint.

### Candidate
ID: sanctum-elysium-loam
Type: approved-outreach-awaiting-contact
Offer: transparency-audit
Current ask: $249
Qualified ask: $999
Evidence: Manual send evidence before the prospect can be treated as contacted.
Evidence form: https://github.com/sata-project-reserve/sata/issues/new?template=outreach-contact-evidence.yml
Contact evidence issue-body command:
```sh
node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"
```
Contact evidence review command:
```sh
npm run ops:outreach-contact-evidence-plan
```
Approved message SHA-256: b5fd3c92884794a7d032a10244fa442d841ead2a948b2c08d86ffd07128e4b98

### Approved Sprint Copy

```text
Hi sanctum-elysium-loam,

Hey, SATA runs a $249 Transparency Audit for crypto teams. We review public authority, supply and concentration, LP ownership or lock evidence, reserve claims, and disclosure gaps, then provide a concise report and machine-readable JSON. No price promotion, no investor targeting, and no market-support promises. If useful, send the token/contract, website, and any reserve or liquidity claims you want checked.

Public profile reviewed: https://sanctumelysium.com/whitepaper.html
Project page reviewed: https://sanctumelysium.com/whitepaper.html

Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_audit_service#invoice-ready-intake
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_sample_audit
Intake form: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam&template=transparency-audit-intake.yml

Any invoice, paid work, token grant, or payment instruction requires Executive Chairman approval.
```

### Sprint Commands

#### Render contact evidence issue body
Prepare the durable evidence issue body before marking the approved outreach sent.

```sh
node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"
```

#### Review submitted contact evidence
After submitting the evidence issue, use the review agent to verify the exact message and SHA-256 before any state update.

```sh
npm run ops:outreach-contact-evidence-plan
```

#### Record verified contact evidence
Run only after the evidence review returns a ready operator command for the submitted issue.

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash b5fd3c92884794a7d032a10244fa442d841ead2a948b2c08d86ffd07128e4b98
```

#### Wait for explicit invoice request
Payment instructions stay locked until the customer asks for an invoice.

```sh
npm run ops:prospect-response-plan
```

## Conversion Stages

### triage-inbound-reply
Eligible stage: live reply or DM evidence
Output stage: needs-intake or invoice-requested-needs-chairman-review
Evidence required: Reply or DM text, source, public profile, project URL, and durable evidence.

```sh
node scripts/inbound-reply-triage-agent.mjs markdown --sourceType <source-type> --sourceId <source-id> --contactHandle "<x-handle-or-contact>" --publicProfileUrl "<https-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --replyText "<reply-or-dm-text>" --evidence "<reply-or-dm-evidence>" --recordedAtUtc "<recorded-at-utc>"
```

### record-sent-contact
Eligible stage: outreach-approved
Output stage: contacted
Evidence required: Manual send evidence or durable contact record.

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet <packetId> --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash "<approved-message-sha256>"
```

### record-invoice-request
Eligible stage: contacted
Output stage: invoice-requested
Evidence required: Customer reply explicitly asking for an invoice.

```sh
node scripts/sats-prospect-response-agent.mjs record-invoice-request --prospect <id> --offer <recommendedOfferId> --evidence "<invoice-request-evidence-url-or-reference>" --confirmedCustomerRequestedInvoice true --requestedAtUtc "<requested-at-utc>"
```

### render-outbound-invoice-request-packet
Eligible stage: invoice-requested
Output stage: chairman-review-packet
Evidence required: Recorded invoice-request stage plus prior contact evidence.

```sh
node scripts/sats-invoice-request-agent.mjs render --prospects "<id>"
```

### render-inbound-invoice-request-packet
Eligible stage: invoice-requested-needs-chairman-review
Output stage: chairman-review-packet
Evidence required: Inbound lead evidence showing explicit invoice request.

```sh
node scripts/inbound-invoice-request-agent.mjs render --lead <id>
```

## Eligible Contact Recording

### sanctum-elysium-loam
Offer: transparency-report-setup
Current approved ask: transparency-audit / $249
Qualified revenue path: $999
Upgrade path: transparency-report-setup only after explicit fit
Priority: 122 / hot
Packet: outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact
Project: https://sanctumelysium.com/whitepaper.html
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_audit_service#invoice-ready-intake
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam&template=transparency-audit-intake.yml
Evidence review command: npm run ops:outreach-contact-evidence-plan

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash b5fd3c92884794a7d032a10244fa442d841ead2a948b2c08d86ffd07128e4b98
```

### meme-launch
Offer: transparency-report-setup
Current approved ask: transparency-audit / $249
Qualified revenue path: $999
Upgrade path: transparency-report-setup only after explicit fit
Priority: 110 / hot
Packet: outreach-packet-20260903-meme-launch-transparency-audit-first-contact
Project: https://memelaunchs.com/results
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_audit_service#invoice-ready-intake
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch&template=transparency-audit-intake.yml
Evidence review command: npm run ops:outreach-contact-evidence-plan

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-meme-launch-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 49a6adeb4c6407604d5c35864339bd0dd78cc18d58d91fab2b96136981947572
```

### instar-meme-futures
Offer: transparency-report-setup
Current approved ask: transparency-audit / $249
Qualified revenue path: $999
Upgrade path: transparency-report-setup only after explicit fit
Priority: 104 / hot
Packet: outreach-packet-20260903-instar-meme-futures-transparency-audit-first-contact
Project: https://instarbrands.com/pages/meme-futures
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_audit_service#invoice-ready-intake
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures&template=transparency-audit-intake.yml
Evidence review command: npm run ops:outreach-contact-evidence-plan

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-instar-meme-futures-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 740e8ecc7c435fb5cc3c5c6f6c576b8c59ea94a6c8f9056baed93f6091f01c0f
```

### soltokenlab
Offer: transparency-report-setup
Current approved ask: transparency-audit / $249
Qualified revenue path: $999
Upgrade path: transparency-report-setup only after explicit fit
Priority: 104 / hot
Packet: outreach-packet-20260903-soltokenlab-transparency-audit-first-contact
Project: https://www.soltokenlab.com/
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_audit_service#invoice-ready-intake
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab&template=transparency-audit-intake.yml
Evidence review command: npm run ops:outreach-contact-evidence-plan

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-soltokenlab-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 4055f13b23cd299675b07e1045643de8f88bbbb282b2b1bc3cac9efbcda9f663
```

### cia-token
Offer: transparency-audit
Current approved ask: transparency-audit / $249
Qualified revenue path: $249
Priority: 104 / hot
Packet: outreach-packet-20260903-cia-token-transparency-audit-first-contact
Project: https://docs.cia.com/technical/usdcia-token
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token_audit_service#invoice-ready-intake
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token&template=transparency-audit-intake.yml
Evidence review command: npm run ops:outreach-contact-evidence-plan

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-cia-token-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash beda97b27c72169f58d9deb547eb720281798563dc5b31a05f05598f05780b65
```

## Eligible Invoice Requests
No contacted prospects are ready for invoice-request recording.

## Outbound Invoice Packets
No outbound invoice-request packets are ready for chairman review.

## Inbound Invoice Requests
No inbound invoice requests are waiting for chairman review.

## Stop Rules
- No payment instructions without a chairman-approved exact-sats invoice.
- No invoice request record unless the customer explicitly asks for an invoice.
- No autonomous transactions, token grants, public posts, paid promotion, or asset movement.
- No reserve progress counted until a direct-reserve receipt is confirmed.
- No price, return, liquidity, buyer, or market-support claims.
