export type BitcoinReserveMetricsInput = {
  reserveSats: bigint;
  sataSupplyRaw: bigint;
  sataDecimals: number;
};

export type BitcoinReserveMetrics = {
  reserveSats: bigint;
  sataSupplyRaw: bigint;
  sataDecimals: number;
  targetReserveSatsForOneSatPerSata: bigint;
  additionalSatsToOneSatPerSata: bigint;
  reserveSatsPerSata: { numerator: bigint; denominator: bigint };
  sataPerReserveSat: { numerator: bigint; denominator: bigint };
  progressToOneSatPerSataPpm: bigint;
};

export function calculateBitcoinReserveMetrics(
  input: BitcoinReserveMetricsInput
): BitcoinReserveMetrics {
  if (input.reserveSats < 0n) {
    throw new Error('Reserve sats must be non-negative.');
  }
  if (input.sataSupplyRaw <= 0n) {
    throw new Error('SATA supply must be greater than zero.');
  }
  if (!Number.isInteger(input.sataDecimals) || input.sataDecimals < 0 || input.sataDecimals > 18) {
    throw new Error('SATA decimals must be an integer between 0 and 18.');
  }

  const sataScale = 10n ** BigInt(input.sataDecimals);
  const targetReserveSatsForOneSatPerSata = ceilDiv(input.sataSupplyRaw, sataScale);
  const additionalSatsToOneSatPerSata =
    targetReserveSatsForOneSatPerSata > input.reserveSats
      ? targetReserveSatsForOneSatPerSata - input.reserveSats
      : 0n;
  const reserveSatsPerSata = reduceFraction(input.reserveSats * sataScale, input.sataSupplyRaw);
  const sataPerReserveSat =
    input.reserveSats === 0n
      ? { numerator: 0n, denominator: 1n }
      : reduceFraction(input.sataSupplyRaw, input.reserveSats * sataScale);

  return {
    reserveSats: input.reserveSats,
    sataSupplyRaw: input.sataSupplyRaw,
    sataDecimals: input.sataDecimals,
    targetReserveSatsForOneSatPerSata,
    additionalSatsToOneSatPerSata,
    reserveSatsPerSata,
    sataPerReserveSat,
    progressToOneSatPerSataPpm:
      targetReserveSatsForOneSatPerSata === 0n
        ? 0n
        : (input.reserveSats * 1_000_000n) / targetReserveSatsForOneSatPerSata
  };
}

export function formatSatsAsBtc(sats: bigint): string {
  if (sats < 0n) {
    throw new Error('Sats must be non-negative.');
  }
  const whole = sats / 100_000_000n;
  const fraction = (sats % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

export function formatFraction(fraction: { numerator: bigint; denominator: bigint }): string {
  return fraction.denominator === 1n
    ? fraction.numerator.toString()
    : `${fraction.numerator.toString()}/${fraction.denominator.toString()}`;
}

function reduceFraction(numerator: bigint, denominator: bigint): { numerator: bigint; denominator: bigint } {
  if (denominator <= 0n) {
    throw new Error('Denominator must be greater than zero.');
  }
  if (numerator === 0n) return { numerator: 0n, denominator: 1n };
  const divisor = gcd(abs(numerator), abs(denominator));
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor
  };
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}
