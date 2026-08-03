# SATA Transparency Reporting

SATA transparency reports are generated from read-only public data. The report job never signs a transaction, asks for a wallet approval, handles private keys, or stores signed transaction bytes.

## Outputs

`npm run transparency:report` writes:

- `public/transparency/latest.json`
- `public/transparency/latest.md`
- `artifacts/transparency/latest.json`
- `artifacts/transparency/latest.md`
- timestamped local copies under `artifacts/transparency/`

The `public/transparency` files are included in the static Next export, so a deployed site can expose stable URLs:

- `https://sata-project-reserve.github.io/sata/transparency/latest.json`
- `https://sata-project-reserve.github.io/sata/transparency/latest.md`

## What The Report Verifies

- SATA mint exists on Solana mainnet.
- Mint owner is the standard SPL Token Program.
- Decimals match the published SATA configuration.
- Current supply does not exceed the launch initial supply; lower current supply is disclosed as a warning.
- Mint authority is revoked.
- Freeze authority is revoked.
- Metaplex metadata PDA and metadata owner program resolve.
- Raydium CPMM SATA/WSOL pool exists.
- Pool reserves are nonzero.
- Pool open time has passed.
- Raydium Burn & Earn LP lock accounts are scanned and verified when found.
- Any owner-held unlocked LP balance is disclosed as removable.
- Bitcoin reserve balance is checked when a public BTC address is configured.
- Bitcoin proof fields are checked against the public transparency register. This is not a substitute for independent BIP-322 cryptographic verification.
- Founder/direct ownership, SATA in the pool, and SATA outside the founder wallet and pool are reported as separate concentration metrics.

## Cadence

The default GitHub Actions schedule runs every 12 hours:

```yaml
cron: '0 */12 * * *'
```

For daily publishing, change it to:

```yaml
cron: '0 12 * * *'
```

The workflow also supports manual runs through `workflow_dispatch`.

## GitHub Pages Publishing

The workflow at `.github/workflows/transparency-report.yml`:

1. Installs dependencies.
2. Runs type-checking, linting, social-policy validation, security checks, and unit tests.
3. Generates the transparency report.
4. Builds the static Next export.
5. Commits the latest public report files.
6. Deploys the `out/` directory to GitHub Pages.

Repository setup required:

- Enable GitHub Actions.
- Set GitHub Pages source to GitHub Actions.
- Keep the repository public if the report should be publicly browsable without authentication.

Optional repository variables:

- `NEXT_PUBLIC_MAINNET_RPC_URL`: public mainnet RPC URL without a secret API key.
- `SATA_PLANNED_RESERVE_SATS`: default `1000000`.
- `SATA_SIGNATURE_SCAN_LIMIT`: default `1000`, the maximum single-page Solana RPC scan used by the report.
- `SATA_BTC_API_BASE`: default `https://mempool.space/api`.
- `SATA_BTC_RESERVE_ADDRESS`: public BTC reserve address.
- `SATA_BTC_RESERVE_MESSAGE`: public signed proof message.
- `SATA_BTC_RESERVE_SIGNATURE`: public signed proof signature.

Do not put API keys, private RPC URLs, seed phrases, private keys, or wallet credentials in repository variables.

## Local Scheduled Alternative

If GitHub Actions is not used, Windows Task Scheduler can run the same read-only command every 12 hours:

```powershell
schtasks /Create /SC HOURLY /MO 12 /TN "SATA Transparency Report" /TR "powershell -NoProfile -ExecutionPolicy Bypass -Command cd G:\SATA; npm run transparency:report"
```

Local scheduling only generates files on the machine. Public publishing still requires a static host, GitHub Pages, or another reviewed deployment path.

## Public Wording

Use:

`SATA publishes a twice-daily transparency report showing mint authority, freeze authority, liquidity, LP lock status, and Bitcoin reserve status from public data. Proof over promises.`

Do not claim:

- guaranteed price
- guaranteed redemption
- risk-free backing
- locked liquidity unless the current report independently verifies locked LP accounts
- GMGN support unless GMGN currently exposes both buy and sell routes
