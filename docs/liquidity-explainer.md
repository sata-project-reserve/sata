# Liquidity Explainer

Creating a token does not make it tradable. Trading normally requires a liquidity pool or market that routing interfaces can discover.

The SATA app defaults to planning a Raydium CPMM SATA/WSOL pool. CPMM liquidity sets an initial mechanical ratio between SATA and SOL. That ratio is not evidence of market value and must not be presented as a promise of return.

LP tokens or liquidity positions remain removable unless a separate locking or burning mechanism is used and independently verified from on-chain accounts.

In mainnet mode, pool creation remains owner-operated. The app prepares the Raydium CPMM transaction only after checking the connected owner balance, SATA token balance, live Raydium fee config, duplicate pool state, current mint/freeze authorities, and spending cap. The owner must still review and approve the transaction in MetaMask.

For Raydium CPMM pools, SATA uses Raydium Burn & Earn as the supported LP-lock path. The app locks only the LP tokens currently held in the owner LP token account, records the Raydium LP-Lock program, lock PDA, lock vault, Fee Key NFT, and transaction signature, then verifies those accounts on-chain. The Fee Key NFT controls future fee claims; the underlying LP tokens are not withdrawable after a verified Burn & Earn lock. Any LP tokens received from later liquidity additions remain removable until they are separately locked and verified.
