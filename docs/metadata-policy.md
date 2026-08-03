# SATA Metadata Policy

SATA metadata is currently mutable. This is disclosed as a warning because the metadata update authority can still change token display fields.

## Current Authority

- Metadata account: `4mwFTi6UkG74Gxp1Q912d1SH7Gg7kXWboRCn4kJffs7g`
- Current update authority: `HtDVYgAwWWzWWTSer1MtNVvJpZHhKjLo2Drzu2eARRaT`
- Current on-chain metadata URI: `https://sata-token-assets.jboudou007.chatgpt.site/mainnet/sata-metadata.json`

The transparency report publishes the current metadata update authority, mutability flag, name, symbol, and URI from the on-chain Metaplex metadata account.

## Why Metadata Remains Mutable

Metadata remains mutable while SATA is still in its first public phase because the official long-term website and asset-hosting strategy are not finalized.

Mutable metadata may be used for:

- Replacing temporary asset hosting with a project-controlled official domain.
- Updating links to the official website, repository, transparency page, X account, DexScreener, or GMGN.
- Correcting broken image, header, or metadata URLs.
- Improving risk disclosures without changing token economics.
- Moving to a more durable content host such as Arweave or IPFS if that becomes the selected long-term path.

Mutable metadata must not be used to:

- Change SATA into a different project.
- Claim guaranteed redemption, guaranteed price, yield, full backing, or locked liquidity beyond what the current report verifies.
- Hide founder concentration, unlocked LP, thin liquidity, or metadata mutability.
- Point users to an undisclosed or unrelated project.

## Change Logging

Material metadata changes should be committed to the public repository before or immediately after the on-chain change.

Each transparency report should expose:

- Current metadata URI.
- Current metadata update authority.
- Current metadata mutability status.
- Current image, website, repository, social, DexScreener, and GMGN links where available.

The material history ledger tracks metadata URI, update authority, and mutability as part of each state snapshot.

## Immutability Criteria

SATA should not make metadata immutable until these conditions are met:

- The official website/domain is selected and live.
- Public metadata assets are hosted on a durable location.
- The transparency report, project profile, token metadata, and social profile agree on canonical links.
- The founder has decided whether metadata authority remains founder-controlled, moves to multisig, or is revoked.
- A final metadata review has confirmed that no field implies redemption rights, guaranteed backing, guaranteed price, yield, or fully locked liquidity.

Until then, mutability is a known centralization risk and should remain visible in public reports.
