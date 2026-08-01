import { describe, expect, it } from 'vitest';
import {
  assertNoSensitiveReportFields,
  classifyLiquidityDisclosure,
  publicationCadenceLabel
} from '@/lib/transparency/reporting';

describe('transparency reporting policy', () => {
  it('reports verified Raydium lock with no owner LP as non-removable', () => {
    const disclosure = classifyLiquidityDisclosure({
      totalLockedLpRaw: 1_000n,
      ownerUnlockedLpRaw: 0n,
      lockProgramVerified: true
    });

    expect(disclosure.status).toBe('LOCKED_BY_RAYDIUM_BURN_AND_EARN');
    expect(disclosure.removable).toBe(false);
  });

  it('discloses owner-removable LP even when some LP is locked', () => {
    const disclosure = classifyLiquidityDisclosure({
      totalLockedLpRaw: 1_000n,
      ownerUnlockedLpRaw: 25n,
      lockProgramVerified: true
    });

    expect(disclosure.status).toBe('PARTIALLY_LOCKED_OWNER_LP_REMAINS');
    expect(disclosure.removable).toBe(true);
  });

  it('does not describe unverified locked balances as fully locked', () => {
    const disclosure = classifyLiquidityDisclosure({
      totalLockedLpRaw: 1_000n,
      ownerUnlockedLpRaw: 0n,
      lockProgramVerified: false
    });

    expect(disclosure.status).toBe('LOCK_REPORTED_NOT_FULLY_VERIFIED');
    expect(disclosure.removable).toBe(false);
  });

  it('supports daily and 12-hour publishing labels', () => {
    expect(publicationCadenceLabel(12)).toBe('every 12 hours');
    expect(publicationCadenceLabel(24)).toBe('daily');
    expect(() => publicationCadenceLabel(0)).toThrow('positive whole number');
  });

  it('rejects sensitive wallet material in public report payloads', () => {
    expect(() =>
      assertNoSensitiveReportFields({
        owner: 'public address only',
        privateKey: 'x'
      })
    ).toThrow('forbidden sensitive field');
    expect(() =>
      assertNoSensitiveReportFields({
        caveat: 'No private keys are included in this public report.'
      })
    ).not.toThrow();
  });
});
