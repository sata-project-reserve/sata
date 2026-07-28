import { PROGRAM_IDS } from '@/lib/solana/constants';

export type MarketReadinessInput = {
  mintExists: boolean;
  expectedTokenProgram: string;
  actualTokenProgram: string;
  metadataResolved: boolean;
  supplyMatchesManifest: boolean;
  mintAuthorityMatchesManifest: boolean;
  freezeAuthorityMatchesManifest: boolean;
  poolExists: boolean;
  sataReserveRaw: bigint;
  wsolReserveLamports: bigint;
  poolOpen: boolean;
  poolProgramId: string;
  buyQuoteAvailable: boolean;
  sellQuoteAvailable: boolean;
  simulatedBuySucceeded: boolean;
  simulatedSellSucceeded: boolean;
  ordinarySellRestrictionAbsent: boolean;
  liquidityNotRemoved: boolean;
  independentMarketDataFound: boolean;
  manifestContainsPoolAndMint: boolean;
};

export type ReadinessCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export function evaluateMarketReadiness(input: MarketReadinessInput): ReadinessCheck[] {
  return [
    check('mint-exists', input.mintExists, 'SATA mint exists on target cluster'),
    check(
      'token-program',
      input.expectedTokenProgram === input.actualTokenProgram,
      input.actualTokenProgram
    ),
    check('metadata', input.metadataResolved, 'Metadata account resolves'),
    check('supply', input.supplyMatchesManifest, 'Supply matches manifest'),
    check('mint-authority', input.mintAuthorityMatchesManifest, 'Mint authority matches manifest'),
    check('freeze-authority', input.freezeAuthorityMatchesManifest, 'Freeze authority matches manifest'),
    check('pool-exists', input.poolExists, 'SATA/WSOL pool exists'),
    check('sata-reserve', input.sataReserveRaw > 0n, input.sataReserveRaw.toString()),
    check('wsol-reserve', input.wsolReserveLamports > 0n, input.wsolReserveLamports.toString()),
    check('pool-open', input.poolOpen, 'Pool is open for trading'),
    check('pool-program', input.poolProgramId === PROGRAM_IDS.raydiumCpmmMainnet, input.poolProgramId),
    check('buy-quote', input.buyQuoteAvailable, 'SOL-to-SATA quote available'),
    check('sell-quote', input.sellQuoteAvailable, 'SATA-to-SOL quote available'),
    check('simulate-buy', input.simulatedBuySucceeded, 'Small buy simulation succeeded'),
    check('simulate-sell', input.simulatedSellSucceeded, 'Small sell simulation succeeded'),
    check('sell-restrictions', input.ordinarySellRestrictionAbsent, 'No ordinary-holder sell block found'),
    check('liquidity-present', input.liquidityNotRemoved, 'Liquidity has not been removed'),
    check('market-data', input.independentMarketDataFound, 'Independent market data source found mint'),
    check('manifest', input.manifestContainsPoolAndMint, 'Manifest contains pool and mint')
  ];
}

function check(id: string, ok: boolean, detail: string): ReadinessCheck {
  return { id, ok, detail };
}
