# Mainnet Readiness Checklist

Mainnet remains locked until all checks pass:

- Unit tests pass.
- Integration tests pass.
- Build passes.
- Lint passes.
- Type checking passes.
- Devnet end-to-end launch completed.
- On-chain post-launch verification completed on devnet.
- Permanent authority revocation consequences acknowledged.
- Token creation does not create liquidity or market value acknowledged.
- Exact maximum SOL spending cap confirmed.
- Confirmation phrase typed exactly: `LAUNCH SATA ON MAINNET`.

Pool creation also requires the phrase `CREATE SATA SOL POOL`.

## Environment Gate Variables

Mainnet mode fails closed unless these are explicitly set after the corresponding evidence exists:

- `NEXT_PUBLIC_APP_MODE=mainnet`
- `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta`
- `NEXT_PUBLIC_MAINNET_RPC_URL=<owner reviewed RPC URL>`
- `NEXT_PUBLIC_SATA_IMAGE_URI=<persistent HTTPS image URL>`
- `NEXT_PUBLIC_SATA_METADATA_URI=<persistent HTTPS metadata JSON URL>`
- `MAINNET_ENABLED=true`
- `MAINNET_UNIT_TESTS_PASSED=true`
- `MAINNET_INTEGRATION_TESTS_PASSED=true`
- `MAINNET_BUILD_PASSED=true`
- `MAINNET_LINT_PASSED=true`
- `MAINNET_TYPECHECK_PASSED=true`
- `MAINNET_DEVNET_E2E_LAUNCH_PASSED=true`
- `MAINNET_ON_CHAIN_VERIFICATION_PASSED=true`
- `MAINNET_AUTHORITY_REVOCATION_ACKNOWLEDGED=true`
- `MAINNET_NO_LIQUIDITY_VALUE_ACKNOWLEDGED=true`
- `MAINNET_SPENDING_CAP_CONFIRMED=true`
- `MAINNET_CONFIRMATION_PHRASE=LAUNCH SATA ON MAINNET`

Do not set the devnet or on-chain verification gates until a real owner-approved devnet launch
manifest has been generated and checked against on-chain state.

The SATA image and metadata URLs must be public, persistent HTTPS URLs. Localhost URLs are allowed
only for devnet testing and are rejected in mainnet mode.
