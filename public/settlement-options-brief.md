# SATA Reserve Token Settlement Options Brief

Generated: 2026-09-11T16:26:24.973Z
Reserve: 500000 sats confirmed, 999500000 sats remaining.

## Boundary
This brief explains settlement options only. It does not approve invoices, send payment instructions, receive funds, convert assets, grant tokens, move assets, or record state.

## Direct Reserve Path
Currency: BTC
Status: implemented-for-all-service-templates
Quote rule: Each invoice must include an exact sats amount, quote source, quote timestamp, and expiration before it is sent to a customer.
Custody rule: No agent may receive funds, hold keys, or redirect payments away from the published reserve address.
Payment address policy: Do not send a payment address or amount from this brief. Render a customer payment packet only after a chairman-approved exact-sats invoice.
Reserve address source: public/transparency/latest.json bitcoinReserve.address

## BTC Invoice Templates

### transparency-audit
Transparency audit for crypto teams / $50
Template ready: true

```sh
node scripts/sats-invoice-quote-agent.mjs write-draft --offer transparency-audit --customer "<customer-or-project-id>" --btcUsd "<manual-btc-usd-rate>" --source "<rate-source-url-or-note>" --createdAtUtc "<created-at-utc>" --ttlMinutes 30 --evidence "<customer-invoice-request-evidence>"
```

### transparency-report-setup
Transparency report setup / $150
Template ready: true

```sh
node scripts/sats-invoice-quote-agent.mjs write-draft --offer transparency-report-setup --customer "<customer-or-project-id>" --btcUsd "<manual-btc-usd-rate>" --source "<rate-source-url-or-note>" --createdAtUtc "<created-at-utc>" --ttlMinutes 30 --evidence "<customer-invoice-request-evidence>"
```

### full-proof-dashboard
Full proof dashboard and workflow setup / $300
Template ready: true

```sh
node scripts/sats-invoice-quote-agent.mjs write-draft --offer full-proof-dashboard --customer "<customer-or-project-id>" --btcUsd "<manual-btc-usd-rate>" --source "<rate-source-url-or-note>" --createdAtUtc "<created-at-utc>" --ttlMinutes 30 --evidence "<customer-invoice-request-evidence>"
```

## Alternative Settlement Paths

### USDC on Solana
Status: planning-only-not-invoice-enabled
USDC on Solana can be considered only after a customer asks for an invoice and there is separate Executive Chairman approval for a recorded settlement path. BTC direct-reserve invoices are the current implemented path.

Required before use:
- customer invoice-request evidence
- chairman-approved settlement decision
- recorded receiving address or escrow terms
- conversion and allocation proposal before any reserve progress is counted
- post-receipt evidence and updated transparency report

Stop rule: Do not send USDC, SOL, wallet, escrow, or conversion instructions from this brief.

### SOL
Status: planning-only-not-invoice-enabled
SOL can be considered only after a customer asks for an invoice and there is separate Executive Chairman approval for a recorded settlement path. BTC direct-reserve invoices are the current implemented path.

Required before use:
- customer invoice-request evidence
- chairman-approved settlement decision
- recorded receiving address or escrow terms
- conversion and allocation proposal before any reserve progress is counted
- post-receipt evidence and updated transparency report

Stop rule: Do not send USDC, SOL, wallet, escrow, or conversion instructions from this brief.

## Customer Reply Templates

### BTC Preferred
```text
BTC direct to the published reserve is the current implemented invoice path. If you want to proceed, send the project link, selected service, and confirmation that you want an invoice. Exact sats, expiration, and payment instructions are sent only after Executive Chairman approval.
```

### Alternative Requested
```text
USDC on Solana or SOL can be reviewed, but it is not the current direct reserve invoice path. Send the selected service, project link, and requested settlement currency. Any address, quote, conversion, allocation, or payment instruction requires separate Executive Chairman approval.
```

## Stop Rules
- No payment address, amount, or QR code from this settlement brief.
- No invoice without customer request evidence.
- No USDC, SOL, wallet, escrow, conversion, or allocation instruction without separate chairman approval.
- No reserve progress counted until direct BTC receipt or approved allocation evidence exists.
- No private keys, seed phrases, custody handoff, price guarantees, redemption promises, or market-support commitments.

## Next Action
Use the BTC-preferred reply when a customer asks how to pay, and record any explicit invoice request before quoting.
