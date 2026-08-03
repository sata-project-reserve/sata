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
npm run transparency:report
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

## Transparency Roadmap

- X/Twitter: [@SATAReserve](https://x.com/SATAReserve)
- Public transparency page: `https://sata-project-reserve.github.io/sata/transparency`
- Raw public reports: `https://sata-project-reserve.github.io/sata/transparency/latest.json` and `https://sata-project-reserve.github.io/sata/transparency/latest.md`
- Material history ledger: `https://sata-project-reserve.github.io/sata/transparency/history.json`
- Deployment health check: `https://sata-project-reserve.github.io/sata/health.json`
- Founder and sole maintainer: [Jean Bilong](https://github.com/jboudou007)
- Machine-readable project profile: `https://sata-project-reserve.github.io/sata/project-profile.json`
- SATA is an independent personal project, not affiliated with or endorsed by the founder's employer, clients, schools, or other organizations.
- [Long-term roadmap](docs/long-term-roadmap.md)
- [Founder and disclosures](docs/founder-and-disclosures.md)
- [Bitcoin treasury policy](docs/bitcoin-treasury-policy.md)
- [Metadata policy](docs/metadata-policy.md)
- [Transparency register](docs/transparency-register.md)
- [Transparency reporting](docs/transparency-reporting.md)
- [Social agent policy](docs/social-agent-policy.md)
- [Social agent runbook](docs/social-agent-runbook.md)
- [Social agent monitoring](docs/social-agent-monitoring.md)

The `1 SATA = 1 sat` idea is treated as an aspirational transparency and adoption milestone, not a guaranteed price target, redemption promise, or market-support claim.

`npm run transparency:report` generates read-only public JSON and Markdown reports under `public/transparency/`. The included GitHub Actions workflow can publish the static report every 12 hours through GitHub Pages.

`public/social-agent-profile.json` provides machine-readable boundaries for a future AI-managed X/Twitter account. `public/social-agent-content-queue.json` contains draft-only starter posts that can be validated with `npm run social:check`. `public/social-agent-monitoring-log.json` records manual post observations until X API monitoring is enabled.
