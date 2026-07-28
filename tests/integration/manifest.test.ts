import { describe, expect, it } from 'vitest';
import { buildLaunchManifest, buildLaunchReport } from '@/lib/manifest/manifest';

describe('manifest generation', () => {
  it('generates redacted manifest and report', () => {
    const manifest = buildLaunchManifest({
      status: 'TOKEN_CREATED',
      network: 'devnet',
      rpcHost: 'https://example.com/rpc?api_key=secret',
      ownerPublicAddress: 'Owner',
      mintAddress: 'Mint',
      metadataAddress: 'Metadata',
      associatedTokenAccount: 'Ata',
      name: 'SATA',
      symbol: 'SATA',
      decimals: 9,
      humanSupply: '1000000000',
      rawSupply: '1000000000000000000',
      mintAuthorityStatus: 'revoked',
      freezeAuthorityStatus: 'revoked',
      transactionSignatures: { create: 'Signature' },
      explorerLinks: {},
      applicationCommitHash: 'none',
      dependencyVersions: { next: '16.2.10' },
      verificationChecks: [{ name: 'supply', ok: true, detail: 'matched' }]
    });
    expect(manifest.rpcHost).not.toContain('secret');
    expect(manifest.explorerLinks.mint).toContain('cluster=devnet');
    expect(buildLaunchReport(manifest)).toContain('SATA Launch Report');
  });
});
