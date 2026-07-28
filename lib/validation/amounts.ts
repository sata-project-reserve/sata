const MAX_U64 = (1n << 64n) - 1n;

export type BaseUnitAmount = {
  raw: bigint;
  decimals: number;
  human: string;
};

export function parseHumanAmountToBaseUnits(input: string, decimals: number): BaseUnitAmount {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('Decimals must be an integer between 0 and 18.');
  }

  const normalized = input.trim().replaceAll('_', '').replaceAll(',', '');
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
    throw new Error('Amount must be a non-negative decimal number.');
  }

  const [wholePart = '0', fractionalPart = ''] = normalized.split('.');
  if (fractionalPart.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimal places.`);
  }

  const paddedFractional = fractionalPart.padEnd(decimals, '0');
  const scale = 10n ** BigInt(decimals);
  const whole = BigInt(wholePart) * scale;
  const fractional = paddedFractional.length === 0 ? 0n : BigInt(paddedFractional);
  const raw = whole + fractional;

  if (raw < 0n || raw > MAX_U64) {
    throw new Error('Amount is outside the u64 SPL Token supply range.');
  }

  return { raw, decimals, human: formatBaseUnits(raw, decimals) };
}

export function formatBaseUnits(raw: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error('Decimals must be a non-negative integer.');
  }

  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  if (decimals === 0 || fraction === 0n) {
    return whole.toString();
  }

  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fractionText}`;
}

export function calculatePercentageBasisPoints(part: bigint, total: bigint): bigint {
  if (total <= 0n) {
    throw new Error('Total must be greater than zero.');
  }
  if (part < 0n || part > total) {
    throw new Error('Part must be between zero and total.');
  }
  return (part * 1_000_000n) / total;
}

export function assertU64(value: bigint, label: string): void {
  if (value < 0n || value > MAX_U64) {
    throw new Error(`${label} must fit in an unsigned 64-bit integer.`);
  }
}

export { MAX_U64 };
