# SATA Reserve Token Outreach Dispatch Brief

Generated: 2026-10-10T13:07:22.567Z
Reserve: 0 sats confirmed, 1000000000 sats remaining.

## Boundary
This brief is for manual dispatch coordination only. It does not approve outreach, contact prospects, send invoices, request payment, move assets, grant tokens, or make public commitments.

## Next Manual Send Sheet
Prospect: sanctum-elysium-loam
Packet: outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact
Current approved ask: $249
Qualified revenue path: $999
Planning reserve impact: 174300 sats current ask / 699300 sats qualified path
Destination: https://sanctumelysium.com/whitepaper.html
Tracked service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_audit_service#invoice-ready-intake
Tracked buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_buyer_packet
Approved message SHA-256: fca5f7edcb4f71bedb2c240cfea36097262c1f85f49d497fc6c6549e25861e28

Send the exact approved message only, submit durable evidence, run evidence review, then record only with the verified command before reply review. Do not send invoices, payment instructions, price claims, grants, or asset movement from this sheet.

Exact approved message:

```text
Hi sanctum-elysium-loam,

Hey, SATA runs a $249 Transparency Audit for crypto teams. We review public authority, supply and concentration, LP ownership or lock evidence, reserve claims, and disclosure gaps, then provide a concise report and machine-readable JSON. No price promotion, no investor targeting, and no market-support promises. If useful, send the token/contract, website, and any reserve or liquidity claims you want checked.

Public profile reviewed: https://sanctumelysium.com/whitepaper.html
Project page reviewed: https://sanctumelysium.com/whitepaper.html

Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_audit_service#invoice-ready-intake
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_sample_audit
Buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_buyer_packet
Intake form: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam&template=transparency-audit-intake.yml

Any invoice, paid work, token grant, or payment instruction requires Executive Chairman approval.
```

Prepare the contact evidence issue body after manual send:

```sh
node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"
```

After manual send, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:outreach-contact-evidence-plan
```

Record contact command:

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash fca5f7edcb4f71bedb2c240cfea36097262c1f85f49d497fc6c6549e25861e28
```

Contact evidence issue body template:

```md
### Outreach packet ID
outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact

### Prospect ID
sanctum-elysium-loam

### Contact channel
public-dm-or-email

### Contact evidence URL or reference
<contact-evidence-url-or-reference>

### Approved message SHA-256
fca5f7edcb4f71bedb2c240cfea36097262c1f85f49d497fc6c6549e25861e28

### Exact message sent
Hi sanctum-elysium-loam,

Hey, SATA runs a $249 Transparency Audit for crypto teams. We review public authority, supply and concentration, LP ownership or lock evidence, reserve claims, and disclosure gaps, then provide a concise report and machine-readable JSON. No price promotion, no investor targeting, and no market-support promises. If useful, send the token/contract, website, and any reserve or liquidity claims you want checked.

Public profile reviewed: https://sanctumelysium.com/whitepaper.html
Project page reviewed: https://sanctumelysium.com/whitepaper.html

Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_audit_service#invoice-ready-intake
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_sample_audit
Buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_buyer_packet
Intake form: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam&template=transparency-audit-intake.yml

Any invoice, paid work, token grant, or payment instruction requires Executive Chairman approval.

### Sent at UTC
<sent-at-utc>
```

## Ready Manual Sends
Sprint: 5 of 30 ready packets. Backlog after this sprint: 25.

Run one focused manual sprint: send the listed packets exactly as approved, submit evidence after each send, run evidence review, then record only with the verified command before reviewing replies or expanding the batch.

## Sprint Economics
Gross service target if current approved asks convert: $1245.
Qualified upgrade path if scoped customers convert: $4245.
Reserve allocation target at 70%: $871.50 current / $2971.50 qualified.
Planning reserve impact at BTC/USD 100000: 871500 sats.
Planning BTC/USD source: operator planning assumption, not a live quote.
Qualified planning reserve impact: 2971500 sats.
grossRevenueUsd is the current approved starter-offer path; qualifiedGrossRevenueUsd is upgrade-path planning only.
Get one explicit invoice request from this manual sprint before expanding spend or outreach volume.
Count only durable contact evidence, replies, invoice requests, approved invoices, confirmed receipts, and post-receipt allocation proposals.

### sanctum-elysium-loam
Packet: outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact
Offer: transparency-audit / $249
Current approved ask: transparency-audit / $249
Qualified revenue path: $999
Planning reserve impact: 174300 sats current ask / 699300 sats qualified path
Planning basis: 70% reserve allocation at BTC/USD 100000
Upgrade path: transparency-report-setup only after explicit fit
Priority: 122 / hot - current offer value $249; qualified upgrade path $999; setup offer has higher reserve-sats leverage; public reporting/setup intent; reserve, treasury, custody, or multisig claims; authority or liquidity claims; multiple public evidence links; direct public project URL; chairman-approved outreach path
Tracking: manual_outreach:outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact
Tracked service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_audit_service#invoice-ready-intake
Tracked sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_sample_audit
Tracked buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_buyer_packet
Tracked intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam&template=transparency-audit-intake.yml
Destination: https://sanctumelysium.com/whitepaper.html

```text
Hi sanctum-elysium-loam,

Hey, SATA runs a $249 Transparency Audit for crypto teams. We review public authority, supply and concentration, LP ownership or lock evidence, reserve claims, and disclosure gaps, then provide a concise report and machine-readable JSON. No price promotion, no investor targeting, and no market-support promises. If useful, send the token/contract, website, and any reserve or liquidity claims you want checked.

Public profile reviewed: https://sanctumelysium.com/whitepaper.html
Project page reviewed: https://sanctumelysium.com/whitepaper.html

Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_audit_service#invoice-ready-intake
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_sample_audit
Buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam_buyer_packet
Intake form: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_sanctum_elysium_loam_transparency_audit_first_contact&utm_content=sanctum_elysium_loam&template=transparency-audit-intake.yml

Any invoice, paid work, token grant, or payment instruction requires Executive Chairman approval.
```

Prepare the contact evidence issue body after manual send:

```sh
node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"
```

After manual send, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:outreach-contact-evidence-plan
```

Record contact command:

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash fca5f7edcb4f71bedb2c240cfea36097262c1f85f49d497fc6c6549e25861e28
```

### meme-launch
Packet: outreach-packet-20260903-meme-launch-transparency-audit-first-contact
Offer: transparency-audit / $249
Current approved ask: transparency-audit / $249
Qualified revenue path: $999
Planning reserve impact: 174300 sats current ask / 699300 sats qualified path
Planning basis: 70% reserve allocation at BTC/USD 100000
Upgrade path: transparency-report-setup only after explicit fit
Priority: 110 / hot - current offer value $249; qualified upgrade path $999; setup offer has higher reserve-sats leverage; public reporting/setup intent; authority or liquidity claims; tooling, launchpad, or platform fit; direct public project URL; chairman-approved outreach path
Tracking: manual_outreach:outreach-packet-20260903-meme-launch-transparency-audit-first-contact
Tracked service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_audit_service#invoice-ready-intake
Tracked sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_sample_audit
Tracked buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_buyer_packet
Tracked intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch&template=transparency-audit-intake.yml
Destination: https://memelaunchs.com/results

```text
Hi meme-launch,

Hey, SATA runs a $249 Transparency Audit for crypto teams. We review public authority, supply and concentration, LP ownership or lock evidence, reserve claims, and disclosure gaps, then provide a concise report and machine-readable JSON. No price promotion, no investor targeting, and no market-support promises. If useful, send the token/contract, website, and any reserve or liquidity claims you want checked.

Public profile reviewed: https://memelaunchs.com/results
Project page reviewed: https://memelaunchs.com/results

Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_audit_service#invoice-ready-intake
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_sample_audit
Buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch_buyer_packet
Intake form: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_meme_launch_transparency_audit_first_contact&utm_content=meme_launch&template=transparency-audit-intake.yml

Any invoice, paid work, token grant, or payment instruction requires Executive Chairman approval.
```

Prepare the contact evidence issue body after manual send:

```sh
node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-meme-launch-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"
```

After manual send, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:outreach-contact-evidence-plan
```

Record contact command:

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-meme-launch-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 52e9e27c51be5a4e76c17f8055e628b21217bf848d1ed038b7eba0fd061c63a3
```

### instar-meme-futures
Packet: outreach-packet-20260903-instar-meme-futures-transparency-audit-first-contact
Offer: transparency-audit / $249
Current approved ask: transparency-audit / $249
Qualified revenue path: $999
Planning reserve impact: 174300 sats current ask / 699300 sats qualified path
Planning basis: 70% reserve allocation at BTC/USD 100000
Upgrade path: transparency-report-setup only after explicit fit
Priority: 104 / hot - current offer value $249; qualified upgrade path $999; setup offer has higher reserve-sats leverage; reserve, treasury, custody, or multisig claims; authority or liquidity claims; tooling, launchpad, or platform fit; direct public project URL; chairman-approved outreach path
Tracking: manual_outreach:outreach-packet-20260903-instar-meme-futures-transparency-audit-first-contact
Tracked service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_audit_service#invoice-ready-intake
Tracked sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_sample_audit
Tracked buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_buyer_packet
Tracked intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures&template=transparency-audit-intake.yml
Destination: https://instarbrands.com/pages/meme-futures

```text
Hi instar-meme-futures,

Hey, SATA runs a $249 Transparency Audit for crypto teams. We review public authority, supply and concentration, LP ownership or lock evidence, reserve claims, and disclosure gaps, then provide a concise report and machine-readable JSON. No price promotion, no investor targeting, and no market-support promises. If useful, send the token/contract, website, and any reserve or liquidity claims you want checked.

Public profile reviewed: https://instarbrands.com/pages/meme-futures
Project page reviewed: https://instarbrands.com/pages/meme-futures

Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_audit_service#invoice-ready-intake
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_sample_audit
Buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures_buyer_packet
Intake form: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_instar_meme_futures_transparency_audit_first_contact&utm_content=instar_meme_futures&template=transparency-audit-intake.yml

Any invoice, paid work, token grant, or payment instruction requires Executive Chairman approval.
```

Prepare the contact evidence issue body after manual send:

```sh
node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-instar-meme-futures-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"
```

After manual send, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:outreach-contact-evidence-plan
```

Record contact command:

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-instar-meme-futures-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 70f79ff619db583082c4456b0c6ca2d221c9a6150a8a2dfbd5ea84c47af3e16f
```

### soltokenlab
Packet: outreach-packet-20260903-soltokenlab-transparency-audit-first-contact
Offer: transparency-audit / $249
Current approved ask: transparency-audit / $249
Qualified revenue path: $999
Planning reserve impact: 174300 sats current ask / 699300 sats qualified path
Planning basis: 70% reserve allocation at BTC/USD 100000
Upgrade path: transparency-report-setup only after explicit fit
Priority: 104 / hot - current offer value $249; qualified upgrade path $999; setup offer has higher reserve-sats leverage; reserve, treasury, custody, or multisig claims; authority or liquidity claims; tooling, launchpad, or platform fit; direct public project URL; chairman-approved outreach path
Tracking: manual_outreach:outreach-packet-20260903-soltokenlab-transparency-audit-first-contact
Tracked service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_audit_service#invoice-ready-intake
Tracked sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_sample_audit
Tracked buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_buyer_packet
Tracked intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab&template=transparency-audit-intake.yml
Destination: https://www.soltokenlab.com/

```text
Hi soltokenlab,

Hey, SATA runs a $249 Transparency Audit for crypto teams. We review public authority, supply and concentration, LP ownership or lock evidence, reserve claims, and disclosure gaps, then provide a concise report and machine-readable JSON. No price promotion, no investor targeting, and no market-support promises. If useful, send the token/contract, website, and any reserve or liquidity claims you want checked.

Public profile reviewed: https://www.soltokenlab.com/
Project page reviewed: https://www.soltokenlab.com/

Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_audit_service#invoice-ready-intake
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_sample_audit
Buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab_buyer_packet
Intake form: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_soltokenlab_transparency_audit_first_contact&utm_content=soltokenlab&template=transparency-audit-intake.yml

Any invoice, paid work, token grant, or payment instruction requires Executive Chairman approval.
```

Prepare the contact evidence issue body after manual send:

```sh
node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-soltokenlab-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"
```

After manual send, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:outreach-contact-evidence-plan
```

Record contact command:

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-soltokenlab-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash ad72ff28369c4f1a90ca14ffbb392f2a179c622c32542330069e621d664afa16
```

### cia-token
Packet: outreach-packet-20260903-cia-token-transparency-audit-first-contact
Offer: transparency-audit / $249
Current approved ask: transparency-audit / $249
Planning reserve impact: 174300 sats current ask / 174300 sats qualified path
Planning basis: 70% reserve allocation at BTC/USD 100000
Priority: 104 / hot - current offer value $249; public reporting/setup intent; reserve, treasury, custody, or multisig claims; authority or liquidity claims; direct public project URL; chairman-approved outreach path
Tracking: manual_outreach:outreach-packet-20260903-cia-token-transparency-audit-first-contact
Tracked service: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token_audit_service#invoice-ready-intake
Tracked sample: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token_sample_audit
Tracked buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token_buyer_packet
Tracked intake: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token&template=transparency-audit-intake.yml
Destination: https://docs.cia.com/technical/usdcia-token

```text
Hi cia-token,

Hey, SATA runs a $249 Transparency Audit for crypto teams. We review public authority, supply and concentration, LP ownership or lock evidence, reserve claims, and disclosure gaps, then provide a concise report and machine-readable JSON. No price promotion, no investor targeting, and no market-support promises. If useful, send the token/contract, website, and any reserve or liquidity claims you want checked.

Public profile reviewed: https://docs.cia.com/technical/usdcia-token
Project page reviewed: https://docs.cia.com/technical/usdcia-token

Service page: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token_audit_service#invoice-ready-intake
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token_sample_audit
Buyer packet: https://sata-project-reserve.github.io/sata/transparency-audit-buyer-packet.md?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token_buyer_packet
Intake form: https://github.com/sata-project-reserve/sata/issues/new?utm_source=manual_outreach&utm_medium=public_dm_or_email&utm_campaign=outreach_packet_20260903_cia_token_transparency_audit_first_contact&utm_content=cia_token&template=transparency-audit-intake.yml

Any invoice, paid work, token grant, or payment instruction requires Executive Chairman approval.
```

Prepare the contact evidence issue body after manual send:

```sh
node scripts/outreach-contact-evidence-agent.mjs render-template --packet outreach-packet-20260903-cia-token-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>"
```

After manual send, submit the evidence issue, review it, and record only with the verified hash-bound command:

Evidence review command:

```sh
npm run ops:outreach-contact-evidence-plan
```

Record contact command:

```sh
node scripts/service-outreach-packet-agent.mjs mark-sent --packet outreach-packet-20260903-cia-token-transparency-audit-first-contact --evidence "<contact-evidence-url-or-reference>" --sentAtUtc "<sent-at-utc>" --messageHash 3baff0316c9feb40ff81e8e29bcd5fb703d5ae487d9ef898064a5793be177bbc
```

## Pending Chairman Outreach Approvals
No outreach approval packets are pending.

## Next Action
Send outreach-packet-20260903-sanctum-elysium-loam-transparency-audit-first-contact exactly as approved, then submit contact evidence for review.
