# SATA Reserve Token Referral Handoff Dispatch Brief

Generated: 2026-09-11T16:07:33.721Z

## Boundary
This brief coordinates manual referral handoff dispatch only. It does not send messages, approve partners, approve compensation, issue invoices, provide payment instructions, publish posts, grant tokens, move assets, or record state.

## Evidence Intake
https://github.com/sata-project-reserve/sata/issues/new?template=referral-handoff-evidence.yml

## Ready Manual Handoffs
Ready candidates: 1 of 1.

### Diana Crypto (@142C_)
Campaign: diana-crypto-20260903-transparency-tweet
Source evidence: https://x.com/142C_/status/2086570576530010172
Packet artifact: public/referral-partner-handoff-packet.md
Approved terms SHA-256: 71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18
Send the exact approved terms manually, then record durable sent evidence with the approved terms SHA-256.
Do not offer upfront compensation, payment instructions, token grants, public posts, invoices, guaranteed results, market support, or asset movement.

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

After manual send, submit the evidence issue and record only with the hash-bound command:

```sh
node scripts/referral-partner-handoff-agent.mjs record-sent --campaign diana-crypto-20260903-transparency-tweet --evidence "<partner-terms-send-evidence>" --sentAtUtc "<sent-at-utc>" --messageHash 71ef634b65ba414aaef782694740d26da37c71d16d0bd65e8593fe4d90945d18
```

If the partner later refers a qualified customer:

```sh
node scripts/inbound-service-lead-agent.mjs record-lead --lead "<lead-id>" --sourceType manual-referral --sourceId referral-partner-diana-crypto --contactHandle "<customer-handle-or-contact>" --publicProfileUrl "<https-customer-profile-url>" --projectUrl "<https-project-url>" --offer transparency-audit --evidence "<referral-and-customer-interest-evidence>" --customerAskedForInvoice false --recordedAtUtc "<recorded-at-utc>" --convertedAtUtc "<converted-at-utc>"
```

## Active Handoffs
No active referral handoffs are awaiting response or referred-lead evidence.

## Next Action
Send exact approved referral terms for diana-crypto-20260903-transparency-tweet, then submit sent evidence with the approved terms SHA-256.
