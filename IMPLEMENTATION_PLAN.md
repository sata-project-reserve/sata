# SATA Launch Application Implementation Plan

## Scope

Build a local, owner-operated Next.js application for safely launching the SATA SPL token, preparing and optionally executing an owner-approved Raydium CPMM SATA/WSOL pool workflow, and producing transparent manifests and reports. The app must never handle seed phrases, private keys, unsigned/signed transaction analytics, or server-side wallet signing.

## Research Notes

- MetaMask Connect Solana: use `@metamask/connect-solana`; it implements Solana Wallet Standard and can be used with Solana Wallet Adapter in React/Next.js.
- Solana SDK: `@solana/kit` is the current modular successor for new Solana JavaScript development, while `@solana/web3.js` remains needed for Solana Wallet Adapter, SPL Token helpers, MetaMask transaction examples, and Raydium SDK compatibility.
- Metaplex: Token Metadata docs recommend `@metaplex-foundation/mpl-token-metadata-kit` for new `@solana/kit` projects, with Umi also supported. The app will isolate metadata builders so package APIs can be upgraded without changing UI safety checks.
- Raydium: CPMM is the preferred default full-range constant-product pool for new pools. Use the official `@raydium-io/raydium-sdk-v2` and allowlist published program IDs.
- GMGN: implement a conservative public-status checker with optional owner-provided API configuration; never claim GMGN tradability until buy and sell routes are confirmed through supported public or authorized responses.

## Implementation Phases

1. Scaffold strict TypeScript Next.js app with linting, formatting, Vitest, Playwright, and security scripts.
2. Add fail-closed environment validation, network mode controls, spending-budget controls, and program-ID allowlists.
3. Implement read-only MetaMask Solana connection through Wallet Standard, showing Solana address, cluster, sanitized RPC hostname, and SOL balance.
4. Implement token configuration validation with exact bigint base-unit conversion and metadata JSON generation.
5. Implement transaction preview models and safety gates used before every wallet request.
6. Implement token-launch transaction planning:
   - create mint
   - create associated token account
   - mint fixed supply
   - create Metaplex metadata
   - verify mint, supply, owner token balance, and metadata
   - persist local manifest data without secrets or signed bytes
7. Implement authority management as isolated actions:
   - revoke mint authority
   - revoke freeze authority
   - transfer metadata update authority
   - make metadata immutable when deliberately selected
8. Implement liquidity planner and Raydium CPMM pool workflow:
   - disabled by default
   - owner-controlled transaction preview
   - exact integer pool ratio calculations
   - duplicate-pool detection hooks
   - on-chain verification shape
9. Implement market-readiness and GMGN status modules:
   - on-chain pool/mint checks
   - route status shape
   - optional canary trade workflow disabled by default
10. Generate launch manifest and report files through local browser downloads and API helpers, redacting secrets and credential-bearing RPC URLs.
11. Add required documentation and runbooks.
12. Add unit, integration, and Playwright tests with mocked wallet signing only.
13. Run quality gates:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run test:e2e`
   - `npm run build`
   - `npm run security:check`
   - `npm run verify:devnet`
14. Fix failures and perform final security review.

## Autonomous Boundary

This implementation stops before any real wallet signature, mainnet token creation, authority revocation, liquidity creation, liquidity lock/burn, or canary trade. All state-changing actions remain owner-initiated in the completed UI and confirmed inside MetaMask.
