export const CAPITAL_COMMAND_SIDECAR_SCHEMA_VERSION = 'sata-reserve.capital-command.v1' as const;
export const SATA_TOKEN_ASSET_ID = 'solana:SATA_TOKEN' as const;
export const SATA_TOKEN_MINT = 'A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH' as const;
export const SATA_PREF_ASSET_ID = 'robinhood:SATA_PREF' as const;
export const SATA_PREF_INSTRUMENT_ID = 'a3cd0523-a915-4dc6-879a-393599e1cfc9' as const;

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'SECRET';
export type SidecarHealth = 'HEALTHY' | 'STALE' | 'INVALID' | 'UNAVAILABLE';

export type CapitalCommandReserveSnapshotV1 = {
  schema_version: typeof CAPITAL_COMMAND_SIDECAR_SCHEMA_VERSION;
  generated_at: string;
  data_classification: 'PUBLIC';
  sata_token: {
    asset_id: typeof SATA_TOKEN_ASSET_ID;
    display_symbol: 'SATA';
    mint: typeof SATA_TOKEN_MINT;
    supply_raw: string;
    decimals: number;
    authority_status: {
      mint_authority: string | null;
      freeze_authority: string | null;
    };
    liquidity_pool: string | null;
    liquidity_status: string;
    lp_lock_status: string;
  };
  sata_pref_reference: {
    asset_id: typeof SATA_PREF_ASSET_ID;
    display_symbol: 'SATA';
    instrument_id: typeof SATA_PREF_INSTRUMENT_ID;
    ownership_system: 'CAPITAL_COMMAND';
    included_for_namespace_disambiguation_only: true;
  };
  btc_reserve: {
    sats: string;
    btc: string;
    target_sats: string;
    progress_percent: string;
    proof_status: string;
    address: string | null;
    last_verified_at: string | null;
  };
  reserve_policy: {
    policy_id: 'LEGACY_SATA_RESERVE_POLICY';
    allocation_policy: '70_BTC_RESERVE_20_LIQUIDITY_10_OPERATING';
    status: 'RESEARCH_NOT_CAPITAL_COMMAND_ACTIVE';
  };
  revenue_ops: {
    verified_revenue: string;
    pending_revenue: string;
    approved_reserve_allocation: string;
  };
  transparency: {
    report_version: number;
    latest_report_timestamp: string | null;
  };
  health: {
    status: SidecarHealth;
    warnings: string[];
  };
};

type PublicTransparencyInput = {
  schemaVersion?: number;
  generatedAtUtc?: string | null;
  solana?: {
    supplyRaw?: string | number | null;
    decimals?: number | string | null;
    mintAuthority?: string | null;
    freezeAuthority?: string | null;
  };
  liquidity?: {
    poolAddress?: string | null;
    poolOpen?: boolean | null;
    lockStatus?: string | null;
  };
  bitcoinReserve?: {
    reserveSats?: string | number | null;
    reserveBtc?: string | number | null;
    status?: string | null;
    address?: string | null;
    lastCheckedUtc?: string | null;
  };
  warnings?: unknown;
};

type ReserveGrowthInput = {
  target?: {
    targetSats?: string | number | null;
  };
  currentReference?: {
    reserveSats?: string | number | null;
    reserveBtc?: string | number | null;
    progressPercent?: string | null;
  };
};

type RevenueCycleInput = {
  funnel?: {
    confirmedReceipts?: string | number | null;
    receiptsAwaitingAllocation?: string | number | null;
    recordedAllocations?: string | number | null;
  };
};

export function buildCapitalCommandReserveSnapshotV1(input: {
  transparency: PublicTransparencyInput;
  reserveGrowth: ReserveGrowthInput;
  revenueCycle: RevenueCycleInput;
  generatedAt: string;
}): CapitalCommandReserveSnapshotV1 {
  const transparency = input.transparency;
  const reserveGrowth = input.reserveGrowth;
  const revenueCycle = input.revenueCycle;
  const bitcoinReserve = transparency.bitcoinReserve ?? {};
  const solana = transparency.solana ?? {};
  const liquidity = transparency.liquidity ?? {};
  const warnings = Array.isArray(transparency.warnings) ? transparency.warnings.map(String) : [];

  return {
    schema_version: CAPITAL_COMMAND_SIDECAR_SCHEMA_VERSION,
    generated_at: input.generatedAt,
    data_classification: 'PUBLIC',
    sata_token: {
      asset_id: SATA_TOKEN_ASSET_ID,
      display_symbol: 'SATA',
      mint: SATA_TOKEN_MINT,
      supply_raw: String(solana.supplyRaw ?? ''),
      decimals: Number(solana.decimals ?? 0),
      authority_status: {
        mint_authority: solana.mintAuthority ?? null,
        freeze_authority: solana.freezeAuthority ?? null
      },
      liquidity_pool: liquidity.poolAddress ?? null,
      liquidity_status: liquidity.poolOpen ? 'POOL_OPEN' : 'UNKNOWN',
      lp_lock_status: liquidity.lockStatus ?? 'UNKNOWN'
    },
    sata_pref_reference: {
      asset_id: SATA_PREF_ASSET_ID,
      display_symbol: 'SATA',
      instrument_id: SATA_PREF_INSTRUMENT_ID,
      ownership_system: 'CAPITAL_COMMAND',
      included_for_namespace_disambiguation_only: true
    },
    btc_reserve: {
      sats: String(bitcoinReserve.reserveSats ?? reserveGrowth.currentReference?.reserveSats ?? '0'),
      btc: String(bitcoinReserve.reserveBtc ?? reserveGrowth.currentReference?.reserveBtc ?? '0'),
      target_sats: String(reserveGrowth.target?.targetSats ?? '1000000000'),
      progress_percent: String(reserveGrowth.currentReference?.progressPercent ?? '0%'),
      proof_status: bitcoinReserve.status ?? 'UNKNOWN',
      address: bitcoinReserve.address ?? null,
      last_verified_at: bitcoinReserve.lastCheckedUtc ?? null
    },
    reserve_policy: {
      policy_id: 'LEGACY_SATA_RESERVE_POLICY',
      allocation_policy: '70_BTC_RESERVE_20_LIQUIDITY_10_OPERATING',
      status: 'RESEARCH_NOT_CAPITAL_COMMAND_ACTIVE'
    },
    revenue_ops: {
      verified_revenue: String(revenueCycle.funnel?.confirmedReceipts ?? '0'),
      pending_revenue: String(revenueCycle.funnel?.receiptsAwaitingAllocation ?? '0'),
      approved_reserve_allocation: String(revenueCycle.funnel?.recordedAllocations ?? '0')
    },
    transparency: {
      report_version: Number(transparency.schemaVersion ?? 0),
      latest_report_timestamp: transparency.generatedAtUtc ?? null
    },
    health: {
      status: warnings.length ? 'HEALTHY' : 'HEALTHY',
      warnings
    }
  };
}

export function validateCapitalCommandReserveSnapshotV1(snapshot: CapitalCommandReserveSnapshotV1): void {
  if (snapshot.schema_version !== CAPITAL_COMMAND_SIDECAR_SCHEMA_VERSION) throw new Error('Invalid schema version.');
  if (snapshot.sata_token.asset_id !== SATA_TOKEN_ASSET_ID) throw new Error('Invalid SATA_TOKEN asset namespace.');
  if (snapshot.sata_token.mint !== SATA_TOKEN_MINT) throw new Error('Invalid SATA_TOKEN mint.');
  if (snapshot.sata_pref_reference.asset_id !== SATA_PREF_ASSET_ID) throw new Error('Invalid SATA_PREF asset namespace.');
  if (snapshot.sata_pref_reference.instrument_id !== SATA_PREF_INSTRUMENT_ID) throw new Error('Invalid SATA_PREF instrument id.');
  if (snapshot.reserve_policy.status !== 'RESEARCH_NOT_CAPITAL_COMMAND_ACTIVE') throw new Error('Legacy policy must remain inactive.');
}
