import { PROGRAM_IDS } from '@/lib/solana/constants';
import type { LiquidityPlan, LiquidityPlanInput, PoolCreationPreview } from './types';
import type { RaydiumCpmmAddresses } from './raydium-cpmm';

export const CREATE_POOL_CONFIRMATION_PHRASE = 'CREATE SATA SOL POOL';

export function buildLiquidityPlan(input: LiquidityPlanInput): LiquidityPlan {
  if (input.sataRawAmount <= 0n || input.solLamports <= 0n) {
    throw new Error('SATA and SOL liquidity amounts must be greater than zero.');
  }
  if (input.sataRawAmount > input.totalSataRawSupply) {
    throw new Error('SATA liquidity amount cannot exceed total supply.');
  }
  if (input.solLamports > input.maxSolBudgetLamports) {
    throw new Error('SOL liquidity amount exceeds the configured pool budget.');
  }

  const percentagePpm = (input.sataRawAmount * 1_000_000n) / input.totalSataRawSupply;
  const sataPerSolScaled = (input.sataRawAmount * 1_000_000_000n) / input.solLamports;
  const lamportsPerSataBaseUnit = input.solLamports / input.sataRawAmount;
  const mechanicalFdvSolScaled =
    input.sataRawAmount === 0n
      ? 0n
      : (input.totalSataRawSupply * input.solLamports * 1_000_000_000n) / input.sataRawAmount;

  return {
    pair: 'SATA/WSOL',
    sataMint: input.sataMint,
    quoteMint: input.quoteMint,
    sataRawAmount: input.sataRawAmount.toString(),
    solLamports: input.solLamports.toString(),
    percentageSupplyAllocatedPpm: percentagePpm.toString(),
    sataPerSolRatio: sataPerSolScaled.toString(),
    lamportsPerSataBaseUnit: lamportsPerSataBaseUnit.toString(),
    impliedSolPricePerSata: `${input.solLamports.toString()} lamports / ${input.sataRawAmount.toString()} base units`,
    mechanicalFdvSol: `${mechanicalFdvSolScaled.toString()} scaled lamports`,
    feeConfigIndex: input.feeConfigIndex,
    poolOpenTimeUnix: input.poolOpenTimeUnix.toString(),
    warnings: [
      'The initial ratio is chosen by the liquidity provider and is not evidence of market value.',
      'LP tokens or positions remain removable unless a separate lock or burn is independently verified.',
      'Thin liquidity can cause severe slippage and volatile prices.'
    ]
  };
}

export function buildPoolCreationPreview(
  plan: LiquidityPlan,
  enabled: boolean,
  raydiumCandidates: RaydiumCpmmAddresses[] = []
): PoolCreationPreview {
  return {
    enabled,
    requiresPhrase: CREATE_POOL_CONFIRMATION_PHRASE,
    typedMintAddressRequired: true,
    allowedProgramIds: [PROGRAM_IDS.raydiumCpmmMainnet, PROGRAM_IDS.splToken, PROGRAM_IDS.associatedToken],
    checks: [
      'Fresh SOL and SATA balances',
      'Connected wallet controls deposited SATA',
      'SATA mint and WSOL mint verified',
      'Raydium CPMM program ID allowlisted',
      'Existing SATA/WSOL pool detection',
      'Pool state verified from on-chain accounts after creation'
    ],
    raydiumCandidates,
    plan
  };
}
