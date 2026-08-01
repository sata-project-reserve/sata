import { describe, expect, it } from 'vitest';
import {
  calculateBitcoinReserveMetrics,
  formatFraction,
  formatSatsAsBtc
} from '@/lib/treasury/bitcoin-reserve';

describe('bitcoin reserve metrics', () => {
  it('calculates the current 1M sat reserve ratio exactly', () => {
    const metrics = calculateBitcoinReserveMetrics({
      reserveSats: 1_000_000n,
      sataSupplyRaw: 1_000_000_000_000_000_000n,
      sataDecimals: 9
    });

    expect(metrics.reserveSatsPerSata).toEqual({ numerator: 1n, denominator: 1000n });
    expect(metrics.sataPerReserveSat).toEqual({ numerator: 1000n, denominator: 1n });
    expect(metrics.targetReserveSatsForOneSatPerSata).toBe(1_000_000_000n);
    expect(metrics.additionalSatsToOneSatPerSata).toBe(999_000_000n);
    expect(metrics.progressToOneSatPerSataPpm).toBe(1000n);
    expect(formatFraction(metrics.reserveSatsPerSata)).toBe('1/1000');
  });

  it('formats sats as BTC without floating point arithmetic', () => {
    expect(formatSatsAsBtc(1_000_000n)).toBe('0.01');
    expect(formatSatsAsBtc(1_000_000_000n)).toBe('10');
    expect(formatSatsAsBtc(123_456_789n)).toBe('1.23456789');
  });

  it('rejects invalid reserve inputs', () => {
    expect(() =>
      calculateBitcoinReserveMetrics({
        reserveSats: -1n,
        sataSupplyRaw: 1n,
        sataDecimals: 9
      })
    ).toThrow(/non-negative/);
    expect(() =>
      calculateBitcoinReserveMetrics({
        reserveSats: 1n,
        sataSupplyRaw: 0n,
        sataDecimals: 9
      })
    ).toThrow(/greater than zero/);
  });
});
