import { describe, expect, it } from 'vitest';
import { buildLaunchManifest, buildLaunchReport } from '@/lib/manifest/manifest';
import { PROGRAM_IDS } from '@/lib/solana/constants';

describe('launch manifest liquidity lock fields', () => {
  it('records Raydium Burn & Earn lock disclosure without secrets', () => {
    const manifest = buildLaunchManifest({
      status: 'POOL_CREATED',
      network: 'mainnet-beta',
      rpcHost: 'https://user:secret@example-rpc.test/?api_key=abcdef123456',
      ownerPublicAddress: 'Owner111111111111111111111111111111111111111',
      mintAddress: 'Mint1111111111111111111111111111111111111111',
      metadataAddress: 'Meta1111111111111111111111111111111111111111',
      associatedTokenAccount: 'Ata11111111111111111111111111111111111111111',
      name: 'SATA',
      symbol: 'SATA',
      decimals: 9,
      humanSupply: '1000000000',
      rawSupply: '1000000000000000000',
      mintAuthorityStatus: 'revoked',
      freezeAuthorityStatus: 'revoked',
      transactionSignatures: {
        'lock-raydium-burn-and-earn-liquidity': 'Sig1111111111111111111111111111111111111111111'
      },
      explorerLinks: {},
      applicationCommitHash: 'test',
      dependencyVersions: {},
      verificationChecks: [
        { name: 'raydium-locked-lp-amount', ok: true, detail: '123' }
      ],
      liquidity: {
        poolAddress: 'Pool111111111111111111111111111111111111111',
        poolProgram: PROGRAM_IDS.raydiumCpmmMainnet,
        pair: 'SATA/WSOL',
        poolOpeningTimestamp: '0',
        sataLiquidity: '1000',
        solLiquidity: '100',
        percentageSupplyInLiquidity: '1',
        liquidityPositionOwner: 'Owner111111111111111111111111111111111111111',
        lockBurnStatus: 'permanently locked via Raydium Burn & Earn',
        lockProgram: PROGRAM_IDS.raydiumCpmmLockMainnet,
        lockPda: 'LockPda111111111111111111111111111111111111',
        lockLpVault: 'LockVault1111111111111111111111111111111111',
        feeKeyNftMint: 'FeeKey111111111111111111111111111111111111',
        feeKeyNftAccount: 'FeeKeyAta111111111111111111111111111111111',
        lockedLpAmountRaw: '123'
      }
    });

    expect(manifest.rpcHost).not.toContain('secret');
    expect(manifest.rpcHost).not.toContain('abcdef');
    expect(manifest.liquidity?.lockProgram).toBe(PROGRAM_IDS.raydiumCpmmLockMainnet);
    expect(manifest.liquidity?.lockedLpAmountRaw).toBe('123');
    expect(manifest.explorerLinks['tx:lock-raydium-burn-and-earn-liquidity']).toContain(
      'https://explorer.solana.com/tx/Sig111'
    );
    expect(buildLaunchReport(manifest)).toContain('Fee Key NFT');
  });
});
