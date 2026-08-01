import { describe, expect, it } from 'vitest';
import { PROGRAM_IDS } from '@/lib/solana/constants';
import { assertAllowedProgramIds } from '@/lib/security/program-allowlist';
import { enforceSpendingControls } from '@/lib/security/spending';
import { validateTransactionPreview } from '@/lib/security/transaction-preview';
import { redactRpcUrl, redactSecretText } from '@/lib/security/redaction';
import { assertMainnetUnlocked, MAINNET_CONFIRMATION_PHRASE } from '@/lib/validation/mainnet-gates';

describe('security controls', () => {
  it('rejects unapproved program IDs', () => {
    expect(() => assertAllowedProgramIds([PROGRAM_IDS.splToken])).not.toThrow();
    expect(() => assertAllowedProgramIds([PROGRAM_IDS.raydiumCpmmLockMainnet])).not.toThrow();
    expect(() => assertAllowedProgramIds(['Bad111111111111111111111111111111111111111'])).toThrow(/unapproved/);
  });

  it('enforces spending cap and reserve', () => {
    expect(() =>
      enforceSpendingControls({
        balanceLamports: 10n,
        estimatedLamports: 3n,
        cumulativeLamports: 2n,
        maxBudgetLamports: 6n,
        reserveLamports: 5n
      })
    ).not.toThrow();
    expect(() =>
      enforceSpendingControls({
        balanceLamports: 10n,
        estimatedLamports: 7n,
        cumulativeLamports: 2n,
        maxBudgetLamports: 8n,
        reserveLamports: 1n
      })
    ).toThrow(/budget/);
    expect(() =>
      enforceSpendingControls({
        balanceLamports: 10n,
        estimatedLamports: 7n,
        cumulativeLamports: 0n,
        maxBudgetLamports: 10n,
        reserveLamports: 4n
      })
    ).toThrow(/reserve/);
  });

  it('validates transaction preview contents', () => {
    expect(() =>
      validateTransactionPreview({
        purpose: 'Create mint',
        network: 'devnet',
        feePayer: 'owner',
        programIds: [PROGRAM_IDS.splToken],
        newAccounts: [],
        estimatedNetworkFeeLamports: 1n,
        estimatedRentLamports: 1n,
        maxSpendLamports: 2n,
        reversible: false,
        permanent: false,
        warnings: []
      })
    ).not.toThrow();
  });

  it('redacts credentials from text and rpc urls', () => {
    expect(redactSecretText('api_key=abcdef123456')).toContain('[REDACTED]');
    expect(redactRpcUrl('https://user:pass@example.com/path?key=abcdef')).toBe('https://example.com/path?key=%5BREDACTED%5D');
  });

  it('keeps mainnet locked unless all gates pass', () => {
    const base = {
      unitTests: true,
      integrationTests: true,
      build: true,
      lint: true,
      typecheck: true,
      devnetE2eLaunch: true,
      onChainVerification: true,
      authorityRevocationAcknowledged: true,
      noLiquidityValueAcknowledged: true,
      spendingCapConfirmed: true,
      confirmationPhrase: MAINNET_CONFIRMATION_PHRASE
    };
    expect(() => assertMainnetUnlocked(base)).not.toThrow();
    expect(() => assertMainnetUnlocked({ ...base, build: false })).toThrow(/build/);
  });
});
