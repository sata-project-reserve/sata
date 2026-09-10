# SATA Reserve Token Reply Conversion Brief

Generated: 2026-09-10T17:06:43.739Z
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
Send outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact exactly as approved, then record contact evidence.

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
Current approved ask: transparency-audit / $50
Qualified revenue path: $150
Upgrade path: transparency-report-setup only after explicit fit
Priority: 112 / hot
Packet: outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact
Project: https://sanctumelysium.com/whitepaper.html
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_audit_service
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam&template=transparency-audit-intake.yml

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 1d37077645c8d720356f548899d61049e8f835d23a5990f2994b6415ba1d1122
```

### meme-launch
Offer: transparency-report-setup
Current approved ask: transparency-audit / $50
Qualified revenue path: $150
Upgrade path: transparency-report-setup only after explicit fit
Priority: 100 / hot
Packet: outreach-packet-20260903-meme-launch-transparency-audit-first-contact
Project: https://memelaunchs.com/results
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_audit_service
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch&template=transparency-audit-intake.yml

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-meme-launch-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash c6b13a9b08f8f021567acf82463cf0a8970e2a24d62ad60525019b4028339bc4
```

### instar-meme-futures
Offer: transparency-report-setup
Current approved ask: transparency-audit / $50
Qualified revenue path: $150
Upgrade path: transparency-report-setup only after explicit fit
Priority: 94 / hot
Packet: outreach-packet-20260903-instar-meme-futures-transparency-audit-first-contact
Project: https://instarbrands.com/pages/meme-futures
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_audit_service
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures&template=transparency-audit-intake.yml

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-instar-meme-futures-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 1feb4dff1091d637a6a3eedc88dbcc094183d7b49ce17d1add1fa6d8cb325a7a
```

### soltokenlab
Offer: transparency-report-setup
Current approved ask: transparency-audit / $50
Qualified revenue path: $150
Upgrade path: transparency-report-setup only after explicit fit
Priority: 94 / hot
Packet: outreach-packet-20260903-soltokenlab-transparency-audit-first-contact
Project: https://www.soltokenlab.com/
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_audit_service
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab&template=transparency-audit-intake.yml

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-soltokenlab-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 8b7dfb9398938bb1b89505f2a6b31b87974425e4ab003dbb082aeee7621ad070
```

### bitdust
Offer: transparency-report-setup
Current approved ask: transparency-audit / $50
Qualified revenue path: $150
Upgrade path: transparency-report-setup only after explicit fit
Priority: 90 / hot
Packet: outreach-packet-20260903-bitdust-transparency-audit-first-contact
Project: https://www.geckoterminal.com/solana/pools/7KcXVi6on67TnmfudJ7X61hdjccF7y62oN96zEoHyDDs
Service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_bitdust_transparency_audit_first_contact&utm_content=bitdust_audit_service
Sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_bitdust_transparency_audit_first_contact&utm_content=bitdust_sample_audit
Intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_bitdust_transparency_audit_first_contact&utm_content=bitdust&template=transparency-audit-intake.yml

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-bitdust-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash ab5485b74f010fd1af64290cfb03f801e6789843f97ff84c3c2f253c0d156d31
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
