import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SCHEMA = 'sata-reserve.capital-command.v1';
const SATA_TOKEN_ASSET_ID = 'solana:SATA_TOKEN';
const SATA_TOKEN_MINT = 'A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH';
const SATA_PREF_ASSET_ID = 'robinhood:SATA_PREF';
const SATA_PREF_INSTRUMENT_ID = 'a3cd0523-a915-4dc6-879a-393599e1cfc9';

const root = process.cwd();
const transparency = JSON.parse(readFileSync(resolve(root, 'public/transparency/latest.json'), 'utf8'));
const reserveGrowth = JSON.parse(readFileSync(resolve(root, 'public/reserve-growth-plan.json'), 'utf8'));
const revenueCycle = JSON.parse(readFileSync(resolve(root, 'public/revenue-cycle-status.json'), 'utf8'));
const bitcoinReserve = transparency.bitcoinReserve ?? {};
const solana = transparency.solana ?? {};
const liquidity = transparency.liquidity ?? {};
const warnings = Array.isArray(transparency.warnings) ? transparency.warnings : [];

const snapshot = {
  schema_version: SCHEMA,
  generated_at: new Date().toISOString(),
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
    status: 'HEALTHY',
    warnings
  }
};

if (snapshot.sata_token.asset_id !== SATA_TOKEN_ASSET_ID) throw new Error('Invalid SATA_TOKEN namespace');
if (snapshot.sata_token.mint !== SATA_TOKEN_MINT) throw new Error('Invalid SATA_TOKEN mint');
if (snapshot.sata_pref_reference.asset_id !== SATA_PREF_ASSET_ID) throw new Error('Invalid SATA_PREF namespace');
if (snapshot.sata_pref_reference.instrument_id !== SATA_PREF_INSTRUMENT_ID) throw new Error('Invalid SATA_PREF instrument');
if (snapshot.reserve_policy.status !== 'RESEARCH_NOT_CAPITAL_COMMAND_ACTIVE') throw new Error('Legacy policy must remain inactive');

const outputPath = resolve(root, 'public/integration/capital-command-reserve-v1.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(outputPath);
