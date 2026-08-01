# Architecture

The app is a local Next.js dashboard with client-side wallet interaction and server-side file-generation helpers only. Wallet signing happens exclusively in MetaMask through MetaMask Connect Solana and Wallet Standard.

Core layers:

- `components/`: step dashboard, wallet panel, token form, previews, authority controls, liquidity and market panels.
- `lib/validation/`: exact amount parsing, metadata validation, environment validation, and readiness gates.
- `lib/security/`: program allowlists, redaction, transaction preview checks, and spending controls.
- `lib/solana/`: transaction planning, token verification, authority state checks, explorer links.
- `lib/wallet/`: MetaMask Connect Solana and Wallet Standard adapter code.
- `lib/metadata/`: metadata JSON generation and validation.
- `lib/manifest/`: manifest/report generation with secret redaction.
- `lib/liquidity-planner/`: disabled-by-default Raydium CPMM planning, deterministic PDA derivation, live fee-config checks, duplicate-pool detection, owner-approved pool/add-liquidity/LP-lock transaction building, and on-chain pool/vault/LP/lock verification.
- `lib/market-readiness/`: market and GMGN status checks.
- `lib/treasury/`: exact Bitcoin reserve ratio and milestone math.
- `lib/transparency/`: public-report disclosure policy, cadence labeling, and sensitive-field guards.
- `scripts/generate-transparency-report.mjs`: read-only scheduled report generator for Solana mint, Raydium liquidity, LP-lock, and optional BTC reserve status.
- `.github/workflows/transparency-report.yml`: optional 12-hour GitHub Pages publication workflow.

No server route signs transactions, stores wallet secrets, or accepts signed transaction bytes.
