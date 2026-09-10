# SATA Referral Partner Packet

Generated: 2026-09-10T13:48:13.341Z
Partner: Diana Crypto (@142C_)
Source ID: referral-partner-diana-crypto

## Boundary
This packet does not approve the partner, compensation, public post, invoice, payment instruction, token grant, transaction, custody change, or asset movement.

## Partner Reply

```text
Thanks Diana Crypto. SATA can consider referral compensation only for legitimate paid transparency-service referrals.

Any relationship must be clearly disclosed to your audience before compensated coverage or referral activity.

Compensation is considered only after a referred customer pays and the receipt is confirmed.

No upfront payment, no price or buyer claims, no fake engagement, no bots, no raids, and no market-support commitment.

Service link: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=referral_diana_crypto&utm_medium=partner_referral&utm_campaign=referral_partner_diana_crypto&utm_content=transparency_audit

Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=referral_diana_crypto&utm_medium=partner_referral&utm_campaign=referral_partner_diana_crypto&utm_content=sample_audit

Referral policy: https://sata-project-reserve.github.io/sata/partners/referrals?utm_source=referral_diana_crypto&utm_medium=partner_referral&utm_campaign=referral_partner_diana_crypto&utm_content=policy

Customer intake: https://github.com/sata-project-reserve/sata/issues/new?template=transparency-audit-intake.yml

Required disclosure: Sponsored/Paid Partnership or token-compensated referral relationship. No price guarantee, no redemption promise, no market-support commitment, and liquidity can be thin and volatile.

Send the referred project, contact path, expected role, requested compensation model, and evidence trail for chairman review.
```

## Tracking
Approved terms SHA-256: 71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18
Service URL: https://sata-project-reserve.github.io/sata/services/transparency-audit?utm_source=referral_diana_crypto&utm_medium=partner_referral&utm_campaign=referral_partner_diana_crypto&utm_content=transparency_audit
Sample audit: https://sata-project-reserve.github.io/sata/services/sample-audit?utm_source=referral_diana_crypto&utm_medium=partner_referral&utm_campaign=referral_partner_diana_crypto&utm_content=sample_audit
Referral policy: https://sata-project-reserve.github.io/sata/partners/referrals?utm_source=referral_diana_crypto&utm_medium=partner_referral&utm_campaign=referral_partner_diana_crypto&utm_content=policy
Customer intake: https://github.com/sata-project-reserve/sata/issues/new?template=transparency-audit-intake.yml

## Compensation Gate
Payment trigger: Only after the referred customer pays and the receipt is confirmed.
Default share: 10% of net service revenue
Maximum share: 20% of net service revenue
Separate token grant approval required: true

## Required Evidence Before Compensation
- Partner identity and contact record.
- Original referral source and timestamp.
- Customer request for paid service.
- Chairman-approved invoice.
- Confirmed customer receipt.
- Proposed referral compensation amount and asset.
- Public or private disclosure evidence, depending on channel.

## Record Referred Lead

```sh
node scripts/inbound-service-lead-agent.mjs record-lead --lead "<lead-id>" --sourceType manual-referral --sourceId referral-partner-diana-crypto --contactHandle "<customer-handle-or-contact>" --publicProfileUrl "<https-customer-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --evidence "<referral-and-customer-interest-evidence>" --customerAskedForInvoice false --recordedAtUtc "<recorded-at-utc>" --convertedAtUtc "<converted-at-utc>"
```

## Record Sent Evidence

```sh
node scripts/referral-partner-handoff-agent.mjs record-sent --campaign diana-crypto-20260903-transparency-tweet --evidence "<partner-terms-send-evidence>" --sentAtUtc "<sent-at-utc>" --messageHash 71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18
```

## Artifact Boundary
This artifact renders approved referral terms for manual review. It does not record a send, approve compensation, issue an invoice, provide payment instructions, grant tokens, or move assets.
