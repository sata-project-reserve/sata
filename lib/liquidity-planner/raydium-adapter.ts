import type { PoolCreationPreview } from './types';
import { detectExistingRaydiumCpmmPool } from './raydium-cpmm';
import type { RaydiumAccountLookup } from './raydium-cpmm';

export type RaydiumPoolCreationResult = {
  poolAddress: string;
  lpMintOrPosition: string;
  vaults: { sataVault: string; wsolVault: string };
  signatures: string[];
};

export type RaydiumPoolAdapter = {
  detectExistingPool(sataMint: string, quoteMint: string): Promise<string | null>;
  createCpmmPool(preview: PoolCreationPreview): Promise<RaydiumPoolCreationResult>;
};

export function createDisabledRaydiumAdapter(options?: {
  accountLookup?: RaydiumAccountLookup;
  feeConfigIndex?: number;
}): RaydiumPoolAdapter {
  return {
    async detectExistingPool(sataMint, quoteMint) {
      if (!options?.accountLookup) return null;
      const existing = await detectExistingRaydiumCpmmPool({
        accountLookup: options.accountLookup,
        sataMint,
        quoteMint,
        feeConfigIndex: options.feeConfigIndex ?? 0
      });
      return existing?.poolId ?? null;
    },
    createCpmmPool() {
      return Promise.reject(
        new Error(
          'Raydium pool creation is disabled. Enable it only after mainnet readiness gates pass.'
        )
      );
    }
  };
}
