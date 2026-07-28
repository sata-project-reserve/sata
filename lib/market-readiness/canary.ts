export type CanaryTradeConfig = {
  enabled: boolean;
  solLamportsToSpend: bigint;
  maxPriceImpactBps: bigint;
};

export function assertCanaryEnabled(config: CanaryTradeConfig): void {
  if (!config.enabled) {
    throw new Error('Mainnet canary trade is disabled by default.');
  }
  if (config.solLamportsToSpend <= 0n) {
    throw new Error('Canary SOL amount must be explicitly configured.');
  }
}
