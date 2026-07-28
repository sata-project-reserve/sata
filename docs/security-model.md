# Security Model

The application treats the browser wallet as the only signer. The owner reviews a human-readable preview, then MetaMask prompts for each transaction. The app validates program IDs, re-fetches recent blockhash/account state before signing, enforces spending controls, and records only public addresses, signatures, and verification results.

Mainnet is fail-closed unless configuration and readiness gates explicitly unlock it. Liquidity pool creation and canary trades are separate disabled workflows.

The app never requests, collects, displays, logs, transmits, or stores seed phrases, private keys, secret recovery phrases, keypair files, environment-variable private keys, local-storage private keys, or raw wallet credentials.
