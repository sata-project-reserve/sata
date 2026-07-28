import { describe, expect, it } from 'vitest';
import { PROGRAM_IDS } from '@/lib/solana/constants';
import {
  buildLiquidityPlan,
  buildPoolCreationPreview,
  CREATE_POOL_CONFIRMATION_PHRASE
} from '@/lib/liquidity-planner/planner';
import {
  deriveRaydiumCpmmPairCandidates,
  detectExistingRaydiumCpmmPool
} from '@/lib/liquidity-planner/raydium-cpmm';
import { evaluateMarketReadiness } from '@/lib/market-readiness/checks';
import { buildGmgnTokenReference, checkGmgnStatus } from '@/lib/market-readiness/gmgn';

describe('liquidity and market readiness', () => {
  it('calculates pool ratios with integers', async () => {
    const plan = buildLiquidityPlan({
      sataMint: PROGRAM_IDS.splToken,
      quoteMint: PROGRAM_IDS.wsolMint,
      sataRawAmount: 1000n,
      solLamports: 100n,
      totalSataRawSupply: 10000n,
      feeConfigIndex: 0,
      poolOpenTimeUnix: 0n,
      maxSolBudgetLamports: 100n,
      minSolReserveLamports: 1n,
      maxAcceptablePriceImpactBps: 100n
    });
    expect(plan.percentageSupplyAllocatedPpm).toBe('100000');
    const raydiumCandidates = await deriveRaydiumCpmmPairCandidates({
      sataMint: PROGRAM_IDS.splToken,
      quoteMint: PROGRAM_IDS.wsolMint,
      feeConfigIndex: 0
    });
    const preview = buildPoolCreationPreview(plan, false, raydiumCandidates);
    expect(preview.requiresPhrase).toBe(CREATE_POOL_CONFIRMATION_PHRASE);
    expect(preview.raydiumCandidates).toHaveLength(2);
    expect(preview.raydiumCandidates[0]?.programId).toBe(PROGRAM_IDS.raydiumCpmmMainnet);
  });

  it('derives Raydium CPMM candidates and detects an existing on-chain pool from mocked accounts', async () => {
    const candidates = await deriveRaydiumCpmmPairCandidates({
      sataMint: PROGRAM_IDS.splToken,
      quoteMint: PROGRAM_IDS.wsolMint,
      feeConfigIndex: 0
    });
    const accountLookup = (poolIds: readonly string[]) => {
      expect(poolIds).toEqual(candidates.map((candidate) => candidate.poolId));
      return Promise.resolve([
        null,
        {
          ownerProgramId: PROGRAM_IDS.raydiumCpmmMainnet,
          lamports: 123n
        }
      ]);
    };

    await expect(
      detectExistingRaydiumCpmmPool({
        accountLookup,
        sataMint: PROGRAM_IDS.splToken,
        quoteMint: PROGRAM_IDS.wsolMint,
        feeConfigIndex: 0
      })
    ).resolves.toMatchObject({
      poolId: candidates[1]?.poolId,
      ownerProgramId: PROGRAM_IDS.raydiumCpmmMainnet,
      lamports: 123n
    });
  });

  it('evaluates all market readiness checks', () => {
    const checks = evaluateMarketReadiness({
      mintExists: true,
      expectedTokenProgram: PROGRAM_IDS.splToken,
      actualTokenProgram: PROGRAM_IDS.splToken,
      metadataResolved: true,
      supplyMatchesManifest: true,
      mintAuthorityMatchesManifest: true,
      freezeAuthorityMatchesManifest: true,
      poolExists: true,
      sataReserveRaw: 1n,
      wsolReserveLamports: 1n,
      poolOpen: true,
      poolProgramId: PROGRAM_IDS.raydiumCpmmMainnet,
      buyQuoteAvailable: true,
      sellQuoteAvailable: true,
      simulatedBuySucceeded: true,
      simulatedSellSucceeded: true,
      ordinarySellRestrictionAbsent: true,
      liquidityNotRemoved: true,
      independentMarketDataFound: true,
      manifestContainsPoolAndMint: true
    });
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it('builds GMGN reference and handles missing API config', async () => {
    expect(buildGmgnTokenReference('Mint')).toBe('https://gmgn.ai/sol/token/Mint');
    await expect(checkGmgnStatus({ mintAddress: 'Mint' })).resolves.toMatchObject({
      status: 'not_yet_indexed',
      buyRoute: false,
      sellRoute: false
    });
  });
});
