# Dependency Decisions

Sources consulted on July 17, 2026 and rechecked on July 27, 2026:

- MetaMask Connect Solana docs: `@metamask/connect-solana` implements Wallet Standard and supports Wallet Adapter integration. This app uses MetaMask Connect directly to avoid bundling unrelated wallet adapters and hardware/mobile wallet transitive dependencies.
- Solana Kit docs: `@solana/kit` is the current modular JavaScript SDK successor for new development.
- SPL Token npm/docs: `@solana/spl-token` remains the stable web3.js v1 helper library for SPL Token and Token-2022 instructions.
- Metaplex token docs: Token Metadata supports fungible token metadata; Kit package exists for new projects, while the established MPL package remains used for instruction compatibility.
- Raydium docs: official TypeScript SDK is `@raydium-io/raydium-sdk-v2`; CPMM is the preferred default constant-product pool for new tokens.

Selected versions:

- Next.js `16.2.10`: latest stable npm release found during research.
- React/React DOM `19.2.7`: latest stable React release found during research.
- TypeScript `5.7.2`: strict-mode compatible current compiler.
- `@metamask/connect-solana` `^0.4.0`: current MetaMask Connect Solana integration package.
- `@solana/kit` `7.0.0`: current modular Solana SDK. The Raydium CPMM planning module uses Kit address/PDA helpers for deterministic pool account derivation without loading wallet or RPC transaction code.
- `@solana/web3.js` `1.98.4`: required by Wallet Adapter, SPL Token helpers, Raydium SDK, and MetaMask examples.
- `@solana/spl-token` `0.4.15`: current SPL Token helper library for web3.js v1.
- `@metaplex-foundation/mpl-token-metadata` `3.4.0`: established Token Metadata client used for instruction compatibility.
- `@raydium-io/raydium-sdk-v2` `0.2.59-alpha`: current official Raydium SDK V2 release found during research. It remains the selected package for future owner-approved CPMM transaction construction; disabled planning code currently reimplements only Raydium's documented deterministic PDA seeds from the installed SDK source.
- Zod `^3.25.76`: mature schema validation library.
- Vitest, Playwright, ESLint, Prettier: test, browser, lint, and formatting quality gates.

Runtime note: current MetaMask/Solana packages require Node `>=20.19.0` or newer. The local machine reported Node `v20.10.0` during install, but build, lint, unit tests, e2e tests, security check, and the read-only devnet verification script were run successfully on July 27, 2026.
