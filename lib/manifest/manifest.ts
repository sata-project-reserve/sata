import { explorerAddressLink, explorerTxLink } from '@/lib/solana/explorer';
import type { SupportedChain } from '@/lib/solana/constants';
import { redactRpcUrl } from '@/lib/security/redaction';

export type LaunchStatus =
  | 'TOKEN_CREATED'
  | 'POOL_CREATED'
  | 'DEX_BUY_ROUTE_CONFIRMED'
  | 'DEX_BUY_AND_SELL_CONFIRMED'
  | 'GMGN_INDEXED_NO_ROUTE'
  | 'GMGN_BUY_ROUTE_CONFIRMED'
  | 'GMGN_FULLY_TRADABLE'
  | 'VERIFICATION_INCOMPLETE';

export type LaunchManifest = {
  status: LaunchStatus;
  network: SupportedChain;
  rpcHost: string;
  ownerPublicAddress: string;
  mintAddress?: string | undefined;
  metadataAddress?: string | undefined;
  associatedTokenAccount?: string | undefined;
  name: string;
  symbol: string;
  decimals: number;
  humanSupply: string;
  rawSupply: string;
  mintAuthorityStatus: string;
  freezeAuthorityStatus: string;
  metadataUpdateAuthority?: string;
  metadataMutable?: boolean;
  transactionSignatures: Record<string, string>;
  explorerLinks: Record<string, string>;
  utcTimestamp: string;
  applicationCommitHash: string;
  dependencyVersions: Record<string, string>;
  verificationChecks: Array<{ name: string; ok: boolean; detail: string }>;
  liquidity?: {
    poolAddress?: string;
    poolProgram?: string;
    pair?: string;
    poolOpeningTimestamp?: string;
    sataLiquidity?: string;
    solLiquidity?: string;
    percentageSupplyInLiquidity?: string;
    liquidityPositionOwner?: string;
    lockBurnStatus?: string;
    lockProgram?: string;
    lockPda?: string;
    lockLpVault?: string;
    feeKeyNftMint?: string;
    feeKeyNftAccount?: string;
    lockedLpAmountRaw?: string;
  };
  gmgn?: {
    buyRouteStatus?: string;
    sellRouteStatus?: string;
    indexingStatus?: string;
    lastVerificationTime?: string;
    tokenPageReference?: string;
    independentMarketDataStatus?: string;
    canaryBuySignature?: string;
    canarySellSignature?: string;
    remainingLimitations?: string[];
  };
};

export function buildLaunchManifest(input: Omit<LaunchManifest, 'utcTimestamp'>): LaunchManifest {
  const explorerLinks: Record<string, string> = { ...input.explorerLinks };
  if (input.mintAddress) explorerLinks.mint = explorerAddressLink(input.mintAddress, input.network);
  if (input.metadataAddress) {
    explorerLinks.metadata = explorerAddressLink(input.metadataAddress, input.network);
  }
  for (const [label, signature] of Object.entries(input.transactionSignatures)) {
    explorerLinks[`tx:${label}`] = explorerTxLink(signature, input.network);
  }

  return {
    ...input,
    rpcHost: redactRpcUrl(input.rpcHost),
    explorerLinks,
    utcTimestamp: new Date().toISOString()
  };
}

export function buildLaunchReport(manifest: LaunchManifest): string {
  const lines = [
    '# SATA Launch Report',
    '',
    `Status: ${manifest.status}`,
    `Network: ${manifest.network}`,
    `RPC host: ${manifest.rpcHost}`,
    `Owner: ${manifest.ownerPublicAddress}`,
    `Mint: ${manifest.mintAddress ?? 'not created'}`,
    `Metadata: ${manifest.metadataAddress ?? 'not created'}`,
    `Associated token account: ${manifest.associatedTokenAccount ?? 'not created'}`,
    `Supply: ${manifest.humanSupply} (${manifest.rawSupply} base units)`,
    `Mint authority: ${manifest.mintAuthorityStatus}`,
    `Freeze authority: ${manifest.freezeAuthorityStatus}`,
    `Generated UTC: ${manifest.utcTimestamp}`,
    '',
    '## Transactions',
    ...Object.entries(manifest.transactionSignatures).map(([label, sig]) => `- ${label}: ${sig}`),
    '',
    '## Verification',
    ...manifest.verificationChecks.map((check) => `- ${check.name}: ${check.ok ? 'pass' : 'fail'} - ${check.detail}`),
    '',
    '## Liquidity',
    `Pool: ${manifest.liquidity?.poolAddress ?? 'not verified'}`,
    `Lock/burn status: ${manifest.liquidity?.lockBurnStatus ?? 'not verified'}`,
    `Fee Key NFT: ${manifest.liquidity?.feeKeyNftMint ?? 'not minted or not verified'}`,
    `Locked LP amount: ${manifest.liquidity?.lockedLpAmountRaw ?? 'not verified'}`,
    '',
    '## GMGN',
    `Indexing: ${manifest.gmgn?.indexingStatus ?? 'not checked'}`,
    `Buy route: ${manifest.gmgn?.buyRouteStatus ?? 'not checked'}`,
    `Sell route: ${manifest.gmgn?.sellRouteStatus ?? 'not checked'}`
  ];
  return `${lines.join('\n')}\n`;
}
