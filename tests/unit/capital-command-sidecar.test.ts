import { describe, expect, it } from 'vitest';
import {
  buildCapitalCommandReserveSnapshotV1,
  SATA_PREF_ASSET_ID,
  SATA_PREF_INSTRUMENT_ID,
  SATA_TOKEN_ASSET_ID,
  SATA_TOKEN_MINT,
  validateCapitalCommandReserveSnapshotV1
} from '../../lib/integration/capital-command-reserve-snapshot';

const transparency = {
  schemaVersion: 1,
  generatedAtUtc: '2026-09-09T19:27:59.534Z',
  solana: {
    sataMint: SATA_TOKEN_MINT,
    supplyRaw: '999996853349945910',
    decimals: 9,
    mintAuthority: null,
    freezeAuthority: null
  },
  liquidity: {
    poolAddress: 'CYRZoXLjgNFTQJnvyJpym1wfTAEoGz6kJMYJFb5hUd8e',
    poolOpen: true,
    lockStatus: 'LOCKED_BY_RAYDIUM_BURN_AND_EARN'
  },
  bitcoinReserve: {
    status: 'verified-balance-and-published-proof',
    address: 'bc1q7dgqqyfh7gxn2kze874d07w4qcj43v4zptv6kk',
    reserveSats: '500000',
    reserveBtc: '0.005',
    lastCheckedUtc: '2026-09-09T19:28:01.106Z'
  },
  warnings: ['metadata-mutability-disclosed: mutable']
};
const reserveGrowth = {
  target: { targetSats: '1000000000' },
  currentReference: { reserveSats: '500000', reserveBtc: '0.005', progressPercent: '0.05%' }
};
const revenueCycle = { funnel: { confirmedReceipts: 0, receiptsAwaitingAllocation: 0, recordedAllocations: 0 } };

describe('Capital Command SATA_RESERVE sidecar snapshot', () => {
  it('namespaces SATA_TOKEN and SATA_PREF without collision', () => {
    const snapshot = buildCapitalCommandReserveSnapshotV1({ transparency, reserveGrowth, revenueCycle, generatedAt: '2026-09-10T00:00:00Z' });
    expect(snapshot.sata_token.asset_id).toBe(SATA_TOKEN_ASSET_ID);
    expect(snapshot.sata_token.mint).toBe(SATA_TOKEN_MINT);
    expect(snapshot.sata_pref_reference.asset_id).toBe(SATA_PREF_ASSET_ID);
    expect(snapshot.sata_pref_reference.instrument_id).toBe(SATA_PREF_INSTRUMENT_ID);
    expect(snapshot.sata_token.asset_id).not.toBe(snapshot.sata_pref_reference.asset_id);
    validateCapitalCommandReserveSnapshotV1(snapshot);
  });

  it('keeps legacy 70/20/10 policy inactive', () => {
    const snapshot = buildCapitalCommandReserveSnapshotV1({ transparency, reserveGrowth, revenueCycle, generatedAt: '2026-09-10T00:00:00Z' });
    expect(snapshot.reserve_policy.policy_id).toBe('LEGACY_SATA_RESERVE_POLICY');
    expect(snapshot.reserve_policy.status).toBe('RESEARCH_NOT_CAPITAL_COMMAND_ACTIVE');
  });

  it('is public-only and does not expose execution secrets', () => {
    const snapshot = buildCapitalCommandReserveSnapshotV1({ transparency, reserveGrowth, revenueCycle, generatedAt: '2026-09-10T00:00:00Z' });
    const serialized = JSON.stringify(snapshot).toLowerCase();
    expect(snapshot.data_classification).toBe('PUBLIC');
    expect(serialized).not.toContain('private_key');
    expect(serialized).not.toContain('seed');
    expect(serialized).toContain('robinhood:sata_pref');
    expect(serialized).not.toContain('account_number');
    for (const prohibited of ['auth_token', 'authorization', 'access_token', 'refresh_token', 'bearer']) {
      expect(serialized).not.toContain(prohibited);
    }
  });
});


