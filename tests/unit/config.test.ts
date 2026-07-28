import { describe, expect, it } from 'vitest';
import { parseAppConfig } from '@/lib/validation/config';
import { MAINNET_CONFIRMATION_PHRASE } from '@/lib/validation/mainnet-gates';

describe('app config mainnet gating', () => {
  it('defaults to devnet with mainnet locked', () => {
    const config = parseAppConfig({});
    expect(config.NEXT_PUBLIC_APP_MODE).toBe('devnet');
    expect(config.mainnetUnlocked).toBe(false);
    expect(config.mainnetGateFailures).toContain('devnetE2eLaunch');
  });

  it('fails closed when mainnet mode is requested without all gates', () => {
    expect(() =>
      parseAppConfig({
        NEXT_PUBLIC_APP_MODE: 'mainnet',
        NEXT_PUBLIC_SOLANA_CLUSTER: 'mainnet-beta',
        NEXT_PUBLIC_MAINNET_RPC_URL: 'https://api.mainnet-beta.solana.com',
        NEXT_PUBLIC_SATA_IMAGE_URI: 'https://assets.example.com/sata-image.svg',
        NEXT_PUBLIC_SATA_METADATA_URI: 'https://assets.example.com/sata-metadata.json',
        MAINNET_ENABLED: 'true'
      })
    ).toThrow(/Mainnet is locked/);
  });

  it('fails closed when mainnet mode lacks persistent metadata assets', () => {
    expect(() =>
      parseAppConfig({
        NEXT_PUBLIC_APP_MODE: 'mainnet',
        NEXT_PUBLIC_SOLANA_CLUSTER: 'mainnet-beta',
        NEXT_PUBLIC_MAINNET_RPC_URL: 'https://api.mainnet-beta.solana.com',
        MAINNET_ENABLED: 'true',
        MAINNET_UNIT_TESTS_PASSED: 'true',
        MAINNET_INTEGRATION_TESTS_PASSED: 'true',
        MAINNET_BUILD_PASSED: 'true',
        MAINNET_LINT_PASSED: 'true',
        MAINNET_TYPECHECK_PASSED: 'true',
        MAINNET_DEVNET_E2E_LAUNCH_PASSED: 'true',
        MAINNET_ON_CHAIN_VERIFICATION_PASSED: 'true',
        MAINNET_AUTHORITY_REVOCATION_ACKNOWLEDGED: 'true',
        MAINNET_NO_LIQUIDITY_VALUE_ACKNOWLEDGED: 'true',
        MAINNET_SPENDING_CAP_CONFIRMED: 'true',
        MAINNET_CONFIRMATION_PHRASE: MAINNET_CONFIRMATION_PHRASE
      })
    ).toThrow(/NEXT_PUBLIC_SATA_IMAGE_URI/);
  });

  it('unlocks mainnet only when every readiness gate is explicit', () => {
    const config = parseAppConfig({
      NEXT_PUBLIC_APP_MODE: 'mainnet',
      NEXT_PUBLIC_SOLANA_CLUSTER: 'mainnet-beta',
      NEXT_PUBLIC_MAINNET_RPC_URL: 'https://api.mainnet-beta.solana.com',
      NEXT_PUBLIC_SATA_IMAGE_URI: 'https://assets.example.com/sata-image.svg',
      NEXT_PUBLIC_SATA_METADATA_URI: 'https://assets.example.com/sata-metadata.json',
      MAINNET_ENABLED: 'true',
      MAINNET_UNIT_TESTS_PASSED: 'true',
      MAINNET_INTEGRATION_TESTS_PASSED: 'true',
      MAINNET_BUILD_PASSED: 'true',
      MAINNET_LINT_PASSED: 'true',
      MAINNET_TYPECHECK_PASSED: 'true',
      MAINNET_DEVNET_E2E_LAUNCH_PASSED: 'true',
      MAINNET_ON_CHAIN_VERIFICATION_PASSED: 'true',
      MAINNET_AUTHORITY_REVOCATION_ACKNOWLEDGED: 'true',
      MAINNET_NO_LIQUIDITY_VALUE_ACKNOWLEDGED: 'true',
      MAINNET_SPENDING_CAP_CONFIRMED: 'true',
      MAINNET_CONFIRMATION_PHRASE: MAINNET_CONFIRMATION_PHRASE
    });
    expect(config.mainnetUnlocked).toBe(true);
    expect(config.mainnetGateFailures).toEqual([]);
  });
});
