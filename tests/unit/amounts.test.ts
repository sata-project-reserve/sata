import { describe, expect, it } from 'vitest';
import { MAX_U64, calculatePercentageBasisPoints, formatBaseUnits, parseHumanAmountToBaseUnits } from '@/lib/validation/amounts';

describe('amount conversion', () => {
  it('converts SATA supply exactly without floating point arithmetic', () => {
    const amount = parseHumanAmountToBaseUnits('1,000,000,000', 9);
    expect(amount.raw).toBe(1_000_000_000_000_000_000n);
    expect(amount.human).toBe('1000000000');
  });

  it('preserves fractional base units exactly', () => {
    expect(parseHumanAmountToBaseUnits('1.000000001', 9).raw).toBe(1_000_000_001n);
    expect(formatBaseUnits(1_000_000_001n, 9)).toBe('1.000000001');
  });

  it('rejects too many decimals', () => {
    expect(() => parseHumanAmountToBaseUnits('1.01', 1)).toThrow(/more than 1/);
  });

  it('rejects invalid decimal configurations', () => {
    expect(() => parseHumanAmountToBaseUnits('1', -1)).toThrow(/Decimals/);
    expect(() => parseHumanAmountToBaseUnits('1', 19)).toThrow(/Decimals/);
  });

  it('enforces u64 maximum boundary', () => {
    expect(parseHumanAmountToBaseUnits(MAX_U64.toString(), 0).raw).toBe(MAX_U64);
    expect(() => parseHumanAmountToBaseUnits((MAX_U64 + 1n).toString(), 0)).toThrow(/u64/);
  });

  it('calculates percentage in ppm', () => {
    expect(calculatePercentageBasisPoints(10n, 100n)).toBe(100000n);
  });
});
