# Authority Revocation

Mint authority revocation permanently prevents minting additional SATA through the SPL Token mint authority. Freeze authority revocation permanently prevents freezing token accounts through the SPL Token freeze authority.

These actions are not liquidity locking. They do not prevent the owner from removing liquidity if the owner controls LP tokens or a liquidity position.

Each revocation must be performed as a separate transaction after fetching the current authority from chain and typing the mint address.
