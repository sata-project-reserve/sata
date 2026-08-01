# Security Model

The application treats the browser wallet as the only signer. The owner reviews a human-readable preview, then MetaMask prompts for each transaction. The app validates program IDs, re-fetches recent blockhash/account state before signing, enforces spending controls, and records only public addresses, signatures, and verification results.

Mainnet is fail-closed unless configuration and readiness gates explicitly unlock it. Liquidity pool creation, Raydium Burn & Earn LP locking, and canary trades are separate owner-approved workflows.

LP locking uses Raydium's allowlisted LP-Lock / Burn & Earn program for CPMM pools. The app verifies the owner LP token account before preparing a lock, displays the irreversible transaction preview, requires the exact lock confirmation phrase, and verifies the lock PDA, lock LP vault, Fee Key NFT owner, and post-lock owner LP balance before reporting liquidity as locked.

The app never requests, collects, displays, logs, transmits, or stores seed phrases, private keys, secret recovery phrases, keypair files, environment-variable private keys, local-storage private keys, or raw wallet credentials.
