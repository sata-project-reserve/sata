# Threat Model

## Covered Threats

- Seed/private-key theft: no secret inputs, keypair files, server-side signing, or credential storage.
- Malicious transaction construction: previews list purpose, programs, accounts, amounts, fees, rent, permanence, and reversibility.
- Compromised RPC responses: critical account state is re-fetched before signing and after confirmation; final reports distinguish RPC-derived checks.
- Dependency compromise: pinned dependencies, security scanning, program allowlists, and minimal dynamic Raydium integration surface.
- Address substitution: mint, metadata, ATA, pool, vault, and authority addresses are shown before signing and persisted after verification.
- Network confusion: cluster and sanitized RPC host are prominent; ambiguous namespaces are rejected.
- Integer and decimal mistakes: token amounts use bigint conversion only.
- Duplicate minting after partial failure: workflow state records completed signatures and verifies on-chain supply before continuing.
- Metadata substitution: metadata URI and JSON are validated and re-read where possible.
- Unauthorized authority changes: authority transactions are isolated, require typed mint address and second confirmation.
- Phishing: UI warns to use a dedicated wallet and never export wallet secrets.
- Supply misrepresentation: raw base-unit and human-readable supply appear in previews and reports.
- Mainnet deployment by mistake: `MAINNET_ENABLED=false` default and exact phrase gate.
- Excessive SOL spending: budget, reserve, per-transaction, and cumulative checks.
- Front-end state differing from on-chain state: verification modules re-fetch on-chain state after transactions.

## Residual Risks

RPC providers, indexers, GMGN, Raydium APIs, and wallet software are external trust boundaries. The app can cross-check but cannot guarantee third-party indexing or route availability.
