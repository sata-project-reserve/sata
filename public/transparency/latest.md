# SATA Transparency Report

Status: TRANSPARENCY_VERIFIED_WITH_DISCLOSURES
Generated UTC: 2026-09-02T20:57:11.894Z
Cadence: scheduled every 12 hours when GitHub Actions is enabled
Slogan: Proof over promises.

This report is read-only. It does not request wallet signatures, spend SOL, upload secrets, or include full RPC URLs.

## Solana

- Network: mainnet-beta
- RPC host: solana-rpc.publicnode.com
- Owner: HtDVYgAwWWzWWTSer1MtNVvJpZHhKjLo2Drzu2eARRaT
- SATA mint: A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH
- Supply: 999996853.34994591 SATA (999996853349945910 base units)
- Launch initial supply: 1000000000 SATA (1000000000000000000 base units)
- Mint authority: revoked
- Freeze authority: revoked
- Metadata: 4mwFTi6UkG74Gxp1Q912d1SH7Gg7kXWboRCn4kJffs7g
- Metadata update authority: HtDVYgAwWWzWWTSer1MtNVvJpZHhKjLo2Drzu2eARRaT
- Metadata mutable: true
- Metadata URI: https://sata-token-assets.jboudou007.chatgpt.site/mainnet/sata-metadata.json

## Liquidity

- DEX: Raydium CPMM
- Pair: SATA/WSOL
- Pool: CYRZoXLjgNFTQJnvyJpym1wfTAEoGz6kJMYJFb5hUd8e
- Pool program: CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C
- Pool open: true
- SATA reserve: 210171504.114371947 (210171504114371947 base units)
- WSOL reserve: 3.407928168 (3407928168 lamports)
- LP mint: 4wp3yZVVdwBvkRnx5qHn8uLRFuw3P9Srt3JvGqn6mrdi
- Total locked LP: 26627909375363
- Owner unlocked LP: 0
- Lock status: LOCKED_BY_RAYDIUM_BURN_AND_EARN
- Removable by owner: false
- Disclosure: Raydium Burn & Earn lock verified and no owner unlocked LP balance was detected.

## Distribution

- Stage: early-stage-founder-led
- Founder role: Founder and sole maintainer
- Founder public GitHub: https://github.com/jboudou007
- Founder direct SATA: 774361428.019676678 (77.43%)
- SATA in pool: 210171504.114371947 (21.01%)
- SATA outside founder wallet and pool: 15463921.215897285 (1.54%)
- Owner unlocked LP: 0
- Locked LP: 26627909375363
- Control caveat: Adding SATA to liquidity reduces direct wallet concentration, but founder control only materially decreases when the resulting LP tokens are locked, burned, or controlled by an accountable multisig.
- Intended direction: Gradually deploy undeployed supply into liquidity and ecosystem uses while publishing whether LP positions remain owner-controlled, locked, burned, or multisig-controlled.

## Raydium Lock Transactions

- 6r2o4X88cZZ8HZZtk1nvCUdFGqvHcr1ByUVZddHyfqcRCeEAjD7pFghLvrJtgU5sEKA78ZEBc37rr7pcBDgD7Qn: 26627909375363 LP base units, verified=true

## Bitcoin Reserve

- Status: verified-balance-and-published-proof
- Address: bc1q7dgqqyfh7gxn2kze874d07w4qcj43v4zptv6kk
- Actual reserve: 500000 sats (0.005 BTC)
- Confirmed reserve: 500000 sats (0.005 BTC)
- Unconfirmed reserve: 0 sats (0 BTC)
- Planned reserve: 500000 sats (0.005 BTC)
- Metrics basis: actual-confirmed-chain
- Proof message: SATA Bitcoin reserve address for Solana mint A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH. No redemption promise. Snapshot UTC: 2026-08-01T13:20:55Z.
- Proof signature: AkcwRAIgTuFktugOzK4NVrAQFqvymy3gREk6LMV8AW9JTE7GvPACIBr8A6wMdHcm2nnN7NuxQmc9ZluTRPabRpp6cwwM9EKpASECMkly6+9vvZrpsgNHhFcSpklkpaluJV8IEsjNLweRTMk=
- Proof validation: proof fields match the public transparency register; independent cryptographic verification should still be performed with Bitcoin tooling
- Sats per SATA: 50000000000000/99999685334994591
- SATA per sat: 99999685334994591/50000000000000
- Target for 1 sat per 1 SATA: 999996854 sats (9.99996854 BTC)
- Additional sats to that treasury milestone: 999496854

The Bitcoin reserve is a transparency metric only. It is not a redemption promise, guaranteed price floor, yield product, or market-support commitment.

## GMGN

- Token page reference: https://gmgn.ai/sol/token/A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH
- Status: manual/public status should be checked from GMGN; this report does not scrape authenticated pages or bypass access controls

## DexScreener

- Pair page reference: https://dexscreener.com/solana/cyrzoxljgnftqjnvyjpym1wftaeogz6kjmyjfb5hud8e
- Token API reference: https://api.dexscreener.com/latest/dex/tokens/A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH
- Status: DexScreener pair indexing is public, but richer token profile fields may require metadata refresh, platform indexing, or a submitted token profile

## Warnings

- sata-supply-equals-launch-initial: 999996853349945910
- metadata-mutability-disclosed: mutable

## Checks

- sata-mint-exists: pass (critical) - A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH
- sata-token-program: pass (critical) - TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
- sata-decimals: pass (critical) - 9
- sata-supply-not-above-launch-initial: pass (critical) - 999996853349945910
- sata-supply-equals-launch-initial: fail (warning) - 999996853349945910
- sata-mint-authority-revoked: pass (critical) - revoked
- sata-freeze-authority-revoked: pass (critical) - revoked
- metadata-pda: pass (critical) - 4mwFTi6UkG74Gxp1Q912d1SH7Gg7kXWboRCn4kJffs7g
- metadata-account-owner: pass (critical) - metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
- metadata-update-authority: pass (warning) - HtDVYgAwWWzWWTSer1MtNVvJpZHhKjLo2Drzu2eARRaT
- metadata-mutability-disclosed: fail (warning) - mutable
- owner-sata-token-account: pass (warning) - GHJHn3hezf11MK1CaS6Ndf5yD4dPKXfig2RKYHArk4aN
- raydium-pool-account: pass (critical) - CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C
- raydium-pool-mints: pass (critical) - So11111111111111111111111111111111111111112, A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH
- raydium-pool-open: pass (critical) - 1785346170
- raydium-sata-reserve: pass (critical) - 210171504114371947
- raydium-wsol-reserve: pass (critical) - 3407928168
- raydium-lp-lock-verified: pass (critical) - Raydium Burn & Earn lock verified and no owner unlocked LP balance was detected.
- owner-unlocked-lp-balance-zero: pass (warning) - 0
- bitcoin-reserve-proof: pass (warning) - verified-balance-and-published-proof

## Links

- Mint explorer: https://explorer.solana.com/address/A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH
- Pool explorer: https://explorer.solana.com/address/CYRZoXLjgNFTQJnvyJpym1wfTAEoGz6kJMYJFb5hUd8e
- Metadata explorer: https://explorer.solana.com/address/4mwFTi6UkG74Gxp1Q912d1SH7Gg7kXWboRCn4kJffs7g
- GMGN: https://gmgn.ai/sol/token/A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH
- DexScreener: https://dexscreener.com/solana/cyrzoxljgnftqjnvyjpym1wftaeogz6kjmyjfb5hud8e

## Permanent Caveats

- SATA has no hidden mint authority when the mint-authority check is passing.
- SATA has no freeze authority when the freeze-authority check is passing.
- SATA is currently founder-led, and direct founder balance plus founder-controlled unlocked LP are disclosed as material concentration risks.
- Liquidity is described as locked only for LP balances independently verified in Raydium Burn & Earn accounts.
- Any owner unlocked LP balance remains removable and is disclosed separately.
- No report field contains seed phrases, private keys, signed transaction bytes, or full RPC URLs.
