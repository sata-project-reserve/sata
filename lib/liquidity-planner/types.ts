export type LiquidityPlanInput = {
  sataMint: string;
  quoteMint: string;
  sataRawAmount: bigint;
  solLamports: bigint;
  totalSataRawSupply: bigint;
  feeConfigIndex: number;
  poolOpenTimeUnix: bigint;
  maxSolBudgetLamports: bigint;
  minSolReserveLamports: bigint;
  maxAcceptablePriceImpactBps: bigint;
};

export type LiquidityPlan = {
  pair: 'SATA/WSOL';
  sataMint: string;
  quoteMint: string;
  sataRawAmount: string;
  solLamports: string;
  percentageSupplyAllocatedPpm: string;
  sataPerSolRatio: string;
  lamportsPerSataBaseUnit: string;
  impliedSolPricePerSata: string;
  mechanicalFdvSol: string;
  feeConfigIndex: number;
  poolOpenTimeUnix: string;
  warnings: string[];
};

export type PoolCreationPreview = {
  enabled: boolean;
  requiresPhrase: 'CREATE SATA SOL POOL';
  typedMintAddressRequired: true;
  allowedProgramIds: string[];
  checks: string[];
  raydiumCandidates: {
    programId: string;
    configId: string;
    mintA: string;
    mintB: string;
    poolId: string;
    authority: string;
    lpMint: string;
    vaultA: string;
    vaultB: string;
    observationId: string;
  }[];
  plan: LiquidityPlan;
};
