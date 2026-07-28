export type SpendingInput = {
  balanceLamports: bigint;
  estimatedLamports: bigint;
  cumulativeLamports: bigint;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
};

export function enforceSpendingControls(input: SpendingInput): void {
  if (input.estimatedLamports < 0n || input.cumulativeLamports < 0n) {
    throw new Error('Estimated spending cannot be negative.');
  }
  if (input.estimatedLamports + input.cumulativeLamports > input.maxBudgetLamports) {
    throw new Error('Estimated spending exceeds the configured SOL budget.');
  }
  if (input.balanceLamports - input.estimatedLamports < input.reserveLamports) {
    throw new Error('Estimated spending would violate the minimum SOL reserve.');
  }
}

export function shouldWarnHighValueWallet(balanceLamports: bigint, requiredLamports: bigint): boolean {
  if (requiredLamports <= 0n) return balanceLamports > 5_000_000_000n;
  return balanceLamports > requiredLamports * 20n;
}
