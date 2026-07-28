# SATA Token Launcher

Local owner-operated web application for creating the SATA Solana token, generating transparent launch records, planning Raydium CPMM liquidity, and checking market readiness. It never asks for or handles seed phrases, private keys, or raw wallet credentials.

## Safety Defaults

- Default mode: `devnet`
- `MAINNET_ENABLED=false`
- Mainnet and pool creation remain locked behind readiness gates and owner confirmations.
- Automated tests mock wallet signing and never request MetaMask signatures.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run security:check
npm run verify:devnet
```

Current MetaMask/Solana package selections require Node `>=20.19.0`; Node `22 LTS` is recommended before running all gates.

## Devnet Use

1. Copy `.env.example` to `.env.local`.
2. Keep `NEXT_PUBLIC_APP_MODE=devnet` and `MAINNET_ENABLED=false`.
3. Start the app with `npm run dev`.
4. Connect MetaMask Solana on devnet.
5. Review every preview before requesting a wallet confirmation.

## Mainnet Boundary

The app is designed to stop before every mainnet transaction. The owner must unlock mainnet after all readiness gates pass and approve each transaction in MetaMask.
