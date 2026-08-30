import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  address,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress
} from '@solana/kit';
import { buildRevenueCycleStatus, validateRevenueCycleStatus } from './lib/revenue-cycle-status.mjs';

await loadLocalEnvFile('.env.local');

const OWNER = 'HtDVYgAwWWzWWTSer1MtNVvJpZHhKjLo2Drzu2eARRaT';
const SATA_MINT = 'A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH';
const EXPECTED_METADATA = '4mwFTi6UkG74Gxp1Q912d1SH7Gg7kXWboRCn4kJffs7g';
const POOL = 'CYRZoXLjgNFTQJnvyJpym1wfTAEoGz6kJMYJFb5hUd8e';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const RAYDIUM_CPMM = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';
const RAYDIUM_LOCK = 'LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE';
const RAYDIUM_LOCK_AUTH = '3f7GcQFG397GAaEnv51zR6tsTVihYRydnydDD1cXekxH';
const EXPECTED_DECIMALS = 9;
const LAUNCH_INITIAL_SUPPLY_RAW = '1000000000000000000';
const SATS_PER_BTC = 100_000_000n;
const DEFAULT_PLANNED_RESERVE_SATS = 1_000_000n;
const DEFAULT_RPC_URL = 'https://solana-rpc.publicnode.com';
const PUBLIC_BASE_URL = 'https://sata-project-reserve.github.io/sata';
const TOKEN_METADATA_URL = 'https://sata-token-assets.jboudou007.chatgpt.site/mainnet/sata-metadata.json';
const PUBLISHED_BTC_PROOF = {
  address: 'bc1q7dgqqyfh7gxn2kze874d07w4qcj43v4zptv6kk',
  message:
    'SATA Bitcoin reserve address for Solana mint A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH. No redemption promise. Snapshot UTC: 2026-08-01T13:20:55Z.',
  signature:
    'AkcwRAIgTuFktugOzK4NVrAQFqvymy3gREk6LMV8AW9JTE7GvPACIBr8A6wMdHcm2nnN7NuxQmc9ZluTRPabRpp6cwwM9EKpASECMkly6+9vvZrpsgNHhFcSpklkpaluJV8IEsjNLweRTMk='
};

const RPC_URL =
  envValue('NEXT_PUBLIC_MAINNET_RPC_URL') ?? envValue('MAINNET_RPC_URL') ?? DEFAULT_RPC_URL;
const BTC_API_BASE = envValue('SATA_BTC_API_BASE') ?? 'https://mempool.space/api';
const PLANNED_RESERVE_SATS = parseUnsignedBigInt(
  envValue('SATA_PLANNED_RESERVE_SATS') ?? DEFAULT_PLANNED_RESERVE_SATS.toString(),
  'SATA_PLANNED_RESERVE_SATS'
);
const SIGNATURE_SCAN_LIMIT = parsePositiveInteger(
  envValue('SATA_SIGNATURE_SCAN_LIMIT') ?? '1000',
  'SATA_SIGNATURE_SCAN_LIMIT'
);
const KNOWN_RAYDIUM_LOCK_SIGNATURES = parseCsvEnv(
  envValue('SATA_RAYDIUM_LOCK_SIGNATURES') ??
    '6r2o4X88cZZ8HZZtk1nvCUdFGqvHcr1ByUVZddHyfqcRCeEAjD7pFghLvrJtgU5sEKA78ZEBc37rr7pcBDgD7Qn'
);
const KNOWN_RAYDIUM_LOCKS = [
  {
    signature: '6r2o4X88cZZ8HZZtk1nvCUdFGqvHcr1ByUVZddHyfqcRCeEAjD7pFghLvrJtgU5sEKA78ZEBc37rr7pcBDgD7Qn',
    slot: 436040963,
    blockTime: 1785367752,
    lockPda: 'DCZc9BAQ6upF6uJgfHbzzWRM17npSWWzr52TBgELXAqu',
    lpMint: '4wp3yZVVdwBvkRnx5qHn8uLRFuw3P9Srt3JvGqn6mrdi',
    lockLpVault: 'e1kdHRnB6boMMcrLbBmZ1Y46mqRcjtZqGTCjrWcC27q',
    feeKeyMint: 'FQq3W44pup68ux6rEZR91AX77Nwth8rH49m9aSouGpT6',
    feeKeyAccount: '46CgAnDrX6Rw3qW88urh7XM5yRba9FmKbf4ry4USDYHm'
  }
];

let requestId = 1;
const addressEncoder = getAddressEncoder();
const addressDecoder = getAddressDecoder();
const execFile = promisify(execFileCallback);

export function formatBaseUnits(amount, decimals) {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

export function formatSatsAsBtc(sats) {
  const value = typeof sats === 'bigint' ? sats : BigInt(sats);
  const whole = value / SATS_PER_BTC;
  const fraction = (value % SATS_PER_BTC).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

export function classifyLiquidityDisclosure({
  totalLockedLpRaw,
  ownerUnlockedLpRaw,
  lockProgramVerified
}) {
  const locked = BigInt(totalLockedLpRaw);
  const unlocked = BigInt(ownerUnlockedLpRaw);
  if (locked > 0n && unlocked === 0n && lockProgramVerified) {
    return {
      status: 'LOCKED_BY_RAYDIUM_BURN_AND_EARN',
      removable: false,
      detail: 'Raydium Burn & Earn lock verified and no owner unlocked LP balance was detected.'
    };
  }
  if (locked > 0n && unlocked > 0n && lockProgramVerified) {
    return {
      status: 'PARTIALLY_LOCKED_OWNER_LP_REMAINS',
      removable: true,
      detail:
        'Raydium Burn & Earn lock verified, but the owner still holds unlocked LP tokens that remain removable unless separately locked or burned.'
    };
  }
  if (locked > 0n) {
    return {
      status: 'LOCK_REPORTED_NOT_FULLY_VERIFIED',
      removable: unlocked > 0n,
      detail:
        'A locked LP balance was detected, but one or more Raydium lock verification checks failed.'
    };
  }
  return {
    status: unlocked > 0n ? 'UNLOCKED_OWNER_LP_PRESENT' : 'LP_LOCK_NOT_VERIFIED',
    removable: unlocked > 0n,
    detail:
      unlocked > 0n
        ? 'Owner LP tokens are present and removable.'
        : 'No Raydium Burn & Earn lock was verified in the scanned transaction window.'
  };
}

export async function generateTransparencyReport() {
  const generatedAt = new Date();
  const checks = [];
  const addCheck = (name, ok, detail, level = 'critical') => {
    checks.push({ name, ok: Boolean(ok), level, detail: String(detail) });
  };

  const rpcHost = safeHost(RPC_URL);
  const [mintAccount, metadataAddress, metadataAccount, ownerSolBalance] = await Promise.all([
    getParsedAccount(SATA_MINT),
    deriveMetadataAddress(SATA_MINT),
    getRawAccount(EXPECTED_METADATA),
    rpc('getBalance', [OWNER, { commitment: 'confirmed' }])
  ]);
  const mintInfo = mintAccount?.data?.parsed?.info ?? null;
  const derivedMetadataMatches = metadataAddress === EXPECTED_METADATA;
  const metadataSummary = metadataAccount ? readMetadataSummary(metadataAccount.data) : null;

  addCheck('sata-mint-exists', Boolean(mintAccount), SATA_MINT);
  addCheck(
    'sata-token-program',
    mintAccount?.owner === TOKEN_PROGRAM,
    mintAccount?.owner ?? 'missing'
  );
  addCheck(
    'sata-decimals',
    mintInfo?.decimals === EXPECTED_DECIMALS,
    mintInfo?.decimals ?? 'missing'
  );
  addCheck(
    'sata-supply-not-above-launch-initial',
    mintInfo ? BigInt(mintInfo.supply) <= BigInt(LAUNCH_INITIAL_SUPPLY_RAW) : false,
    mintInfo?.supply ?? 'missing'
  );
  addCheck(
    'sata-supply-equals-launch-initial',
    mintInfo?.supply === LAUNCH_INITIAL_SUPPLY_RAW,
    mintInfo?.supply ?? 'missing',
    'warning'
  );
  addCheck(
    'sata-mint-authority-revoked',
    mintInfo ? !mintInfo.mintAuthority : false,
    mintInfo?.mintAuthority ?? (mintInfo ? 'revoked' : 'missing')
  );
  addCheck(
    'sata-freeze-authority-revoked',
    mintInfo ? !mintInfo.freezeAuthority : false,
    mintInfo?.freezeAuthority ?? (mintInfo ? 'revoked' : 'missing')
  );
  addCheck('metadata-pda', derivedMetadataMatches, metadataAddress);
  addCheck(
    'metadata-account-owner',
    metadataAccount?.owner === METADATA_PROGRAM,
    metadataAccount?.owner ?? 'missing'
  );
  addCheck(
    'metadata-update-authority',
    metadataSummary?.updateAuthority === OWNER,
    metadataSummary?.updateAuthority ?? 'unknown',
    'warning'
  );
  addCheck(
    'metadata-mutability-disclosed',
    metadataSummary?.mutable === false,
    metadataSummary?.mutable === true ? 'mutable' : (metadataSummary?.mutable ?? 'unknown'),
    'warning'
  );

  const ownerSataAta = await deriveAssociatedTokenAddress(OWNER, SATA_MINT);
  const ownerSataBalance = await getTokenBalance(ownerSataAta);
  addCheck('owner-sata-token-account', ownerSataBalance !== null, ownerSataAta, 'warning');

  const pool = await readPoolState();
  addCheck(
    'raydium-pool-account',
    pool.accountOwner === RAYDIUM_CPMM,
    pool.accountOwner ?? 'missing'
  );
  addCheck(
    'raydium-pool-mints',
    [pool.mintA, pool.mintB].includes(SATA_MINT) && [pool.mintA, pool.mintB].includes(WSOL_MINT),
    `${pool.mintA}, ${pool.mintB}`
  );
  addCheck('raydium-pool-open', pool.poolOpen, pool.openTimeUnix.toString());
  addCheck('raydium-sata-reserve', pool.sataReserveRaw > 0n, pool.sataReserveRaw.toString());
  addCheck(
    'raydium-wsol-reserve',
    pool.wsolReserveLamports > 0n,
    pool.wsolReserveLamports.toString()
  );

  const ownerLpAta = await deriveAssociatedTokenAddress(OWNER, pool.lpMint);
  const ownerLpBalance = await getTokenBalance(ownerLpAta);
  const lockReport = await readRaydiumLockReport(pool, ownerLpAta);
  const liquidityDisclosure = classifyLiquidityDisclosure({
    totalLockedLpRaw: lockReport.totalLockedLpRaw,
    ownerUnlockedLpRaw: ownerLpBalance?.amount ?? '0',
    lockProgramVerified: lockReport.verified
  });
  addCheck('raydium-lp-lock-verified', lockReport.verified, liquidityDisclosure.detail);
  addCheck(
    'owner-unlocked-lp-balance-zero',
    BigInt(ownerLpBalance?.amount ?? '0') === 0n,
    ownerLpBalance?.amount ?? '0',
    'warning'
  );

  const bitcoinReserve = await readBitcoinReserve();
  const reserveMetrics = buildReserveMetrics({
    reserveSats: bitcoinReserve.reserveSats ?? PLANNED_RESERVE_SATS,
    supplyRaw: BigInt(mintInfo?.supply ?? LAUNCH_INITIAL_SUPPLY_RAW),
    decimals: Number(mintInfo?.decimals ?? EXPECTED_DECIMALS)
  });
  const distribution = buildDistributionMetrics({
    supplyRaw: BigInt(mintInfo?.supply ?? LAUNCH_INITIAL_SUPPLY_RAW),
    decimals: Number(mintInfo?.decimals ?? EXPECTED_DECIMALS),
    ownerSataRaw: BigInt(ownerSataBalance?.amount ?? '0'),
    poolSataRaw: pool.sataReserveRaw,
    ownerUnlockedLpRaw: BigInt(ownerLpBalance?.amount ?? '0'),
    totalLockedLpRaw: BigInt(lockReport.totalLockedLpRaw)
  });
  addCheck(
    'bitcoin-reserve-proof',
    bitcoinReserve.proofValidation?.ok === true,
    bitcoinReserve.status,
    'warning'
  );

  const criticalOk = checks
    .filter((check) => check.level === 'critical')
    .every((check) => check.ok);
  const warningCount = checks.filter((check) => check.level === 'warning' && !check.ok).length;
  const status = criticalOk
    ? warningCount > 0
      ? 'TRANSPARENCY_VERIFIED_WITH_DISCLOSURES'
      : 'TRANSPARENCY_VERIFIED'
    : 'VERIFICATION_INCOMPLETE';
  const sourceCommit = await getSourceCommit();

  return {
    schemaVersion: 1,
    status,
    project: 'SATA',
    slogan: 'Proof over promises.',
    generatedAtUtc: generatedAt.toISOString(),
    reportCadence: 'scheduled every 12 hours when GitHub Actions is enabled',
    source: {
      commit: sourceCommit,
      repository: 'https://github.com/sata-project-reserve/sata',
      transparencyPage: `${PUBLIC_BASE_URL}/transparency`,
      latestJson: `${PUBLIC_BASE_URL}/transparency/latest.json`,
      historyJson: `${PUBLIC_BASE_URL}/transparency/history.json`,
      revenueCycleStatusJson: `${PUBLIC_BASE_URL}/revenue-cycle-status.json`,
      healthJson: `${PUBLIC_BASE_URL}/health.json`
    },
    network: 'mainnet-beta',
    rpcHost,
    owner: OWNER,
    solana: {
      ownerSolLamports: String(ownerSolBalance.value),
      ownerSol: formatBaseUnits(ownerSolBalance.value, 9),
      sataMint: SATA_MINT,
      tokenProgram: mintAccount?.owner ?? null,
      decimals: mintInfo?.decimals ?? null,
      supplyRaw: mintInfo?.supply ?? null,
      supplyUi: mintInfo?.supply ? formatBaseUnits(mintInfo.supply, EXPECTED_DECIMALS) : null,
      launchInitialSupplyRaw: LAUNCH_INITIAL_SUPPLY_RAW,
      launchInitialSupplyUi: formatBaseUnits(LAUNCH_INITIAL_SUPPLY_RAW, EXPECTED_DECIMALS),
      mintAuthority: mintInfo?.mintAuthority ?? null,
      freezeAuthority: mintInfo?.freezeAuthority ?? null,
      ownerSataAta,
      ownerSataRaw: ownerSataBalance?.amount ?? '0',
      metadataAddress: EXPECTED_METADATA,
      derivedMetadataAddress: metadataAddress,
      metadataOwnerProgram: metadataAccount?.owner ?? null,
      metadataUpdateAuthority: metadataSummary?.updateAuthority ?? null,
      metadataMutable: metadataSummary?.mutable ?? 'unknown',
      metadataName: metadataSummary?.name ?? null,
      metadataSymbol: metadataSummary?.symbol ?? null,
      metadataUri: metadataSummary?.uri ?? null
    },
    liquidity: {
      dex: 'Raydium CPMM',
      pair: 'SATA/WSOL',
      poolAddress: POOL,
      poolProgram: pool.accountOwner,
      lpMint: pool.lpMint,
      mintA: pool.mintA,
      mintB: pool.mintB,
      sataVault: pool.sataVault,
      wsolVault: pool.wsolVault,
      sataReserveRaw: pool.sataReserveRaw.toString(),
      sataReserveUi: formatBaseUnits(pool.sataReserveRaw, EXPECTED_DECIMALS),
      wsolReserveLamports: pool.wsolReserveLamports.toString(),
      wsolReserveUi: formatBaseUnits(pool.wsolReserveLamports, 9),
      poolOpenTimeUnix: pool.openTimeUnix.toString(),
      poolOpen: pool.poolOpen,
      ownerLpAta,
      ownerUnlockedLpRaw: ownerLpBalance?.amount ?? '0',
      lockProgram: RAYDIUM_LOCK,
      lockAuthority: RAYDIUM_LOCK_AUTH,
      lockStatus: liquidityDisclosure.status,
      lockDisclosure: liquidityDisclosure.detail,
      removable: liquidityDisclosure.removable,
      totalLockedLpRaw: lockReport.totalLockedLpRaw,
      latestLockSignature: lockReport.latestSignature,
      lockTransactions: lockReport.locks
    },
    distribution,
    bitcoinReserve: {
      ...bitcoinReserve,
      plannedReserveSats: PLANNED_RESERVE_SATS.toString(),
      plannedReserveBtc: formatSatsAsBtc(PLANNED_RESERVE_SATS),
      metricsBasis:
        bitcoinReserve.reserveSats === null
          ? 'planned'
          : bitcoinReserve.mempoolReserveSats > 0n
            ? 'actual-including-mempool'
            : 'actual-confirmed-chain',
      reserveSats: bitcoinReserve.reserveSats?.toString() ?? null,
      confirmedReserveSats: bitcoinReserve.confirmedReserveSats?.toString() ?? null,
      confirmedReserveBtc:
        bitcoinReserve.confirmedReserveSats === null
          ? null
          : formatSatsAsBtc(bitcoinReserve.confirmedReserveSats),
      mempoolReserveSats: bitcoinReserve.mempoolReserveSats?.toString() ?? null,
      mempoolReserveBtc:
        bitcoinReserve.mempoolReserveSats === null
          ? null
          : formatSatsAsBtc(bitcoinReserve.mempoolReserveSats),
      reserveBtc:
        bitcoinReserve.reserveSats === null ? null : formatSatsAsBtc(bitcoinReserve.reserveSats),
      targetReserveSatsForOneSatPerSata: reserveMetrics.targetReserveSats.toString(),
      targetReserveBtcForOneSatPerSata: formatSatsAsBtc(reserveMetrics.targetReserveSats),
      additionalSatsToOneSatPerSata: reserveMetrics.additionalSats.toString(),
      satsPerSata: reserveMetrics.satsPerSata,
      sataPerSat: reserveMetrics.sataPerSat,
      progressToOneSatPerSataPpm: reserveMetrics.progressPpm.toString(),
      caveat:
        'The Bitcoin reserve is a transparency metric only. It is not a redemption promise, guaranteed price floor, yield product, or market-support commitment.'
    },
    gmgn: {
      tokenPageReference: `https://gmgn.ai/sol/token/${SATA_MINT}`,
      indexingStatus:
        'manual/public status should be checked from GMGN; this report does not scrape authenticated pages or bypass access controls'
    },
    dexscreener: {
      pairPageReference: `https://dexscreener.com/solana/${POOL.toLowerCase()}`,
      tokenApiReference: `https://api.dexscreener.com/latest/dex/tokens/${SATA_MINT}`,
      indexingStatus:
        'DexScreener pair indexing is public, but richer token profile fields may require metadata refresh, platform indexing, or a submitted token profile'
    },
    links: {
      mintExplorer: `https://explorer.solana.com/address/${SATA_MINT}`,
      poolExplorer: `https://explorer.solana.com/address/${POOL}`,
      metadataExplorer: `https://explorer.solana.com/address/${EXPECTED_METADATA}`,
      gmgn: `https://gmgn.ai/sol/token/${SATA_MINT}`,
      dexscreener: `https://dexscreener.com/solana/${POOL.toLowerCase()}`
    },
    checks,
    warnings: checks
      .filter((check) => check.level === 'warning' && !check.ok)
      .map((check) => `${check.name}: ${check.detail}`),
    permanentCaveats: [
      'SATA has no hidden mint authority when the mint-authority check is passing.',
      'SATA has no freeze authority when the freeze-authority check is passing.',
      'SATA is currently founder-led, and direct founder balance plus founder-controlled unlocked LP are disclosed as material concentration risks.',
      'Liquidity is described as locked only for LP balances independently verified in Raydium Burn & Earn accounts.',
      'Any owner unlocked LP balance remains removable and is disclosed separately.',
      'No report field contains seed phrases, private keys, signed transaction bytes, or full RPC URLs.'
    ]
  };
}

async function readPoolState() {
  const account = await getRawAccount(POOL);
  if (!account) {
    throw new Error(`Raydium pool account not found: ${POOL}`);
  }
  const data = Buffer.from(account.data, 'base64');
  const pool = decodeCpmmPool(data);
  const sataVault = pool.mintA === SATA_MINT ? pool.vaultA : pool.vaultB;
  const wsolVault = pool.mintA === WSOL_MINT ? pool.vaultA : pool.vaultB;
  const [sataBalance, wsolBalance] = await Promise.all([
    getTokenBalance(sataVault),
    getTokenBalance(wsolVault)
  ]);
  return {
    ...pool,
    accountOwner: account.owner,
    sataVault,
    wsolVault,
    sataReserveRaw: BigInt(sataBalance?.amount ?? '0'),
    wsolReserveLamports: BigInt(wsolBalance?.amount ?? '0'),
    poolOpen: pool.openTimeUnix <= BigInt(Math.floor(Date.now() / 1000))
  };
}

async function readRaydiumLockReport(pool, ownerLpAta) {
  const locks = await findRaydiumLockInstructions([OWNER, ownerLpAta]);
  const byLockVault = new Map();
  for (const item of locks) {
    const lockVault = item.accounts[10];
    if (lockVault && !byLockVault.has(lockVault)) {
      byLockVault.set(lockVault, item);
    }
  }
  for (const known of KNOWN_RAYDIUM_LOCKS) {
    if (!byLockVault.has(known.lockLpVault)) {
      const accounts = [];
      accounts[0] = RAYDIUM_LOCK_AUTH;
      accounts[2] = OWNER;
      accounts[3] = OWNER;
      accounts[4] = known.feeKeyMint;
      accounts[5] = known.feeKeyAccount;
      accounts[6] = POOL;
      accounts[7] = known.lockPda;
      accounts[8] = known.lpMint;
      accounts[10] = known.lockLpVault;
      byLockVault.set(known.lockLpVault, {
        signature: known.signature,
        slot: known.slot,
        blockTime: known.blockTime,
        accounts
      });
    }
  }

  const lockRows = [];
  let totalLockedLpRaw = 0n;
  let verified = byLockVault.size > 0;
  for (const item of byLockVault.values()) {
    const accounts = item.accounts;
    const lockPda = accounts[7];
    const lpMint = accounts[8];
    const lockLpVault = accounts[10];
    const feeKeyAccount = accounts[5];
    const feeKeyMint = accounts[4];
    const [lockPdaAccount, lockVaultAccount, feeKey] = await Promise.all([
      getRawAccount(lockPda),
      getParsedAccount(lockLpVault),
      getParsedAccount(feeKeyAccount)
    ]);
    const lockVaultInfo = lockVaultAccount?.data?.parsed?.info ?? null;
    const feeKeyInfo = feeKey?.data?.parsed?.info ?? null;
    const lockedAmountRaw = BigInt(lockVaultInfo?.tokenAmount?.amount ?? '0');
    totalLockedLpRaw += lockedAmountRaw;
    const rowChecks = [
      accounts[0] === RAYDIUM_LOCK_AUTH,
      accounts[2] === OWNER,
      accounts[3] === OWNER,
      accounts[6] === POOL,
      lockPdaAccount?.owner === RAYDIUM_LOCK,
      lpMint === pool.lpMint,
      lockVaultAccount?.owner === TOKEN_PROGRAM,
      lockVaultInfo?.owner === RAYDIUM_LOCK_AUTH,
      lockVaultInfo?.mint === pool.lpMint,
      lockedAmountRaw > 0n,
      feeKey?.owner === TOKEN_PROGRAM,
      feeKeyInfo?.owner === OWNER,
      feeKeyInfo?.mint === feeKeyMint,
      feeKeyInfo?.tokenAmount?.amount === '1'
    ];
    const rowVerified = rowChecks.every(Boolean);
    verified = verified && rowVerified;
    lockRows.push({
      signature: item.signature,
      slot: item.slot,
      blockTimeUtc: item.blockTime ? new Date(item.blockTime * 1000).toISOString() : null,
      lockPda,
      lpMint,
      lockLpVault,
      lockedLpAmountRaw: lockedAmountRaw.toString(),
      feeKeyMint,
      feeKeyAccount,
      verified: rowVerified
    });
  }

  return {
    verified,
    totalLockedLpRaw: totalLockedLpRaw.toString(),
    latestSignature: lockRows[0]?.signature ?? null,
    locks: lockRows
  };
}

async function findRaydiumLockInstructions(scanAddresses) {
  const signatureMap = new Map();
  for (const scanAddress of scanAddresses) {
    try {
      const signatures = await rpc('getSignaturesForAddress', [
        scanAddress,
        { limit: SIGNATURE_SCAN_LIMIT, commitment: 'confirmed' }
      ]);
      for (const info of signatures) {
        if (!signatureMap.has(info.signature)) {
          signatureMap.set(info.signature, info);
        }
      }
    } catch {
      // Some scan addresses may not have transaction history yet.
    }
  }
  for (const signature of KNOWN_RAYDIUM_LOCK_SIGNATURES) {
    if (!signatureMap.has(signature)) {
      signatureMap.set(signature, { signature, err: null });
    }
  }
  const locks = [];
  for (const info of signatureMap.values()) {
    if (info.err) continue;
    const tx = await rpc('getTransaction', [
      info.signature,
      {
        commitment: 'confirmed',
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0
      }
    ]);
    if (!tx) continue;
    for (const instruction of allInstructions(tx)) {
      if (instruction.programId !== RAYDIUM_LOCK) continue;
      const accounts = instruction.accounts ?? [];
      if (accounts[6] !== POOL) continue;
      locks.push({
        signature: info.signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        accounts
      });
    }
  }
  return locks.sort((left, right) => right.slot - left.slot);
}

function allInstructions(tx) {
  const topLevel = tx?.transaction?.message?.instructions ?? [];
  const inner = (tx?.meta?.innerInstructions ?? []).flatMap((group) => group.instructions ?? []);
  return [...topLevel, ...inner];
}

async function readBitcoinReserve() {
  const reserveAddress = envValue('SATA_BTC_RESERVE_ADDRESS');
  const proofMessage = envValue('SATA_BTC_RESERVE_MESSAGE');
  const proofSignature = envValue('SATA_BTC_RESERVE_SIGNATURE');
  const proofValidation = validatePublishedBitcoinProof({
    address: reserveAddress,
    message: proofMessage,
    signature: proofSignature
  });
  if (!reserveAddress) {
    return {
      status: 'pending-address',
      address: null,
      reserveSats: null,
      confirmedReserveSats: null,
      mempoolReserveSats: null,
      proofMessage: null,
      proofSignature: null,
      proofValidation,
      lastCheckedUtc: new Date().toISOString()
    };
  }

  try {
    const response = await fetch(joinUrl(BTC_API_BASE, `address/${reserveAddress}`), {
      headers: { accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = await response.json();
    const confirmedReserveSats =
      BigInt(body.chain_stats?.funded_txo_sum ?? 0) -
      BigInt(body.chain_stats?.spent_txo_sum ?? 0);
    const mempoolReserveSats =
      BigInt(body.mempool_stats?.funded_txo_sum ?? 0) -
      BigInt(body.mempool_stats?.spent_txo_sum ?? 0);
    const reserveSats = confirmedReserveSats + mempoolReserveSats;
    const pendingSuffix = mempoolReserveSats > 0n ? '-with-unconfirmed-funds' : '';
    const proofSuffix = proofValidation.ok ? 'and-published-proof' : 'only-proof-validation-failed';
    return {
      status: `verified-balance-${proofSuffix}${pendingSuffix}`,
      address: reserveAddress,
      reserveSats,
      confirmedReserveSats,
      mempoolReserveSats,
      proofMessage: proofMessage || null,
      proofSignature: proofSignature || null,
      proofValidation,
      lastCheckedUtc: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: `fetch-failed: ${error instanceof Error ? error.message : String(error)}`,
      address: reserveAddress,
      reserveSats: null,
      confirmedReserveSats: null,
      mempoolReserveSats: null,
      proofMessage: proofMessage || null,
      proofSignature: proofSignature || null,
      proofValidation,
      lastCheckedUtc: new Date().toISOString()
    };
  }
}

function validatePublishedBitcoinProof({ address, message, signature }) {
  if (!address) return { ok: false, method: 'published-register-match', detail: 'missing address' };
  if (!message || !signature) {
    return {
      ok: false,
      method: 'published-register-match',
      detail: 'missing proof message or signature'
    };
  }
  const decoded = Buffer.from(signature, 'base64');
  const base64RoundTrip = decoded.toString('base64') === signature;
  if (!base64RoundTrip) {
    return { ok: false, method: 'published-register-match', detail: 'signature is not valid base64' };
  }
  const matchesRegister =
    address === PUBLISHED_BTC_PROOF.address &&
    message === PUBLISHED_BTC_PROOF.message &&
    signature === PUBLISHED_BTC_PROOF.signature;
  return {
    ok: matchesRegister,
    method: 'published-register-match',
    detail: matchesRegister
      ? 'proof fields match the public transparency register; independent cryptographic verification should still be performed with Bitcoin tooling'
      : 'proof fields do not match the public transparency register'
  };
}

function buildDistributionMetrics({
  supplyRaw,
  decimals,
  ownerSataRaw,
  poolSataRaw,
  ownerUnlockedLpRaw,
  totalLockedLpRaw
}) {
  const outsideFounderAndPoolRaw = supplyRaw - ownerSataRaw - poolSataRaw;
  const safeOutsideRaw = outsideFounderAndPoolRaw > 0n ? outsideFounderAndPoolRaw : 0n;
  return {
    stage: 'early-stage-founder-led',
    founderRole: 'Founder and sole maintainer',
    founderPublicGithub: 'https://github.com/jboudou007',
    founderDisclosure:
      "SATA is an independent personal project and is not affiliated with or endorsed by the founder's employer, clients, schools, or other organizations.",
    founderDirectRaw: ownerSataRaw.toString(),
    founderDirectUi: formatBaseUnits(ownerSataRaw, decimals),
    founderDirectPercent: formatPercent(ownerSataRaw, supplyRaw),
    poolSataRaw: poolSataRaw.toString(),
    poolSataUi: formatBaseUnits(poolSataRaw, decimals),
    poolSataPercent: formatPercent(poolSataRaw, supplyRaw),
    outsideFounderAndPoolRaw: safeOutsideRaw.toString(),
    outsideFounderAndPoolUi: formatBaseUnits(safeOutsideRaw, decimals),
    outsideFounderAndPoolPercent: formatPercent(safeOutsideRaw, supplyRaw),
    ownerUnlockedLpRaw: ownerUnlockedLpRaw.toString(),
    totalLockedLpRaw: totalLockedLpRaw.toString(),
    controlCaveat:
      'Adding SATA to liquidity reduces direct wallet concentration, but founder control only materially decreases when the resulting LP tokens are locked, burned, or controlled by an accountable multisig.',
    intendedDirection:
      'Gradually deploy undeployed supply into liquidity and ecosystem uses while publishing whether LP positions remain owner-controlled, locked, burned, or multisig-controlled.'
  };
}

function buildReserveMetrics({ reserveSats, supplyRaw, decimals }) {
  const scale = 10n ** BigInt(decimals);
  const targetReserveSats = ceilDiv(supplyRaw, scale);
  const additionalSats = targetReserveSats > reserveSats ? targetReserveSats - reserveSats : 0n;
  const satsPerSata = reduceFraction(reserveSats * scale, supplyRaw);
  const sataPerSat =
    reserveSats === 0n
      ? { numerator: 0n, denominator: 1n }
      : reduceFraction(supplyRaw, reserveSats * scale);
  const progressPpm =
    targetReserveSats === 0n ? 0n : (reserveSats * 1_000_000n) / targetReserveSats;
  return {
    targetReserveSats,
    additionalSats,
    satsPerSata: stringifyFraction(satsPerSata),
    sataPerSat: stringifyFraction(sataPerSat),
    progressPpm
  };
}

function formatPercent(amount, total) {
  if (total <= 0n) return '0.00%';
  const basisPoints = (amount * 10_000n) / total;
  const whole = basisPoints / 100n;
  const fraction = (basisPoints % 100n).toString().padStart(2, '0');
  return `${whole.toString()}.${fraction}%`;
}

async function writeReports(report) {
  const slug = report.generatedAtUtc.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const artifactDir = join('artifacts', 'transparency');
  const publicDir = join('public', 'transparency');
  await Promise.all([
    mkdir(artifactDir, { recursive: true }),
    mkdir(publicDir, { recursive: true })
  ]);
  const history = await buildHistoryLedger(report, publicDir);
  const health = buildHealthReport(report, history);
  const revenueCycleStatus = await buildPublishedRevenueCycleStatus(report);
  const sitemap = buildSitemap(report);
  const robots = buildRobots();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = buildMarkdownReport(report);
  const historyJson = `${JSON.stringify(history, null, 2)}\n`;
  const historyMarkdown = buildHistoryMarkdown(history);
  const healthJson = `${JSON.stringify(health, null, 2)}\n`;
  const revenueCycleStatusJson = `${JSON.stringify(revenueCycleStatus, null, 2)}\n`;
  await Promise.all([
    writeFile(join(artifactDir, `sata-transparency-${slug}.json`), json, 'utf8'),
    writeFile(join(artifactDir, `sata-transparency-${slug}.md`), markdown, 'utf8'),
    writeFile(join(artifactDir, 'latest.json'), json, 'utf8'),
    writeFile(join(artifactDir, 'latest.md'), markdown, 'utf8'),
    writeFile(join(artifactDir, 'history.json'), historyJson, 'utf8'),
    writeFile(join(artifactDir, 'history.md'), historyMarkdown, 'utf8'),
    writeFile(join(publicDir, 'latest.json'), json, 'utf8'),
    writeFile(join(publicDir, 'latest.md'), markdown, 'utf8'),
    writeFile(join(publicDir, 'history.json'), historyJson, 'utf8'),
    writeFile(join(publicDir, 'history.md'), historyMarkdown, 'utf8'),
    writeFile(join('public', 'revenue-cycle-status.json'), revenueCycleStatusJson, 'utf8'),
    writeFile(join('public', 'health.json'), healthJson, 'utf8'),
    writeFile(join('public', 'sitemap.xml'), sitemap, 'utf8'),
    writeFile(join('public', 'robots.txt'), robots, 'utf8')
  ]);
  return {
    artifactJson: join(artifactDir, `sata-transparency-${slug}.json`),
    artifactMarkdown: join(artifactDir, `sata-transparency-${slug}.md`),
    publicJson: join(publicDir, 'latest.json'),
    publicMarkdown: join(publicDir, 'latest.md'),
    publicHistoryJson: join(publicDir, 'history.json'),
    publicRevenueCycleStatusJson: join('public', 'revenue-cycle-status.json'),
    publicHealthJson: join('public', 'health.json')
  };
}

async function buildPublishedRevenueCycleStatus(report) {
  const status = buildRevenueCycleStatus({
    report,
    revenuePlan: await readRequiredJson(join('public', 'revenue-operating-plan.json')),
    ledger: await readRequiredJson(join('public', 'sats-generation-ledger.json')),
    invoiceQueue: await readRequiredJson(join('public', 'sats-invoice-queue.json')),
    prospectPipeline: await readRequiredJson(join('public', 'sats-prospect-pipeline.json')),
    socialQueue: await readRequiredJson(join('public', 'social-agent-content-queue.json')),
    env: {}
  });
  validateRevenueCycleStatus(status);
  return status;
}

async function buildHistoryLedger(report, publicDir) {
  const previous = await readJsonIfExists(join(publicDir, 'history.json'));
  const entries = Array.isArray(previous?.entries) ? previous.entries : [];
  const entry = buildHistoryEntry(report);
  const latestEntry = entries.at(-1);
  const nextEntries =
    latestEntry?.stateHash === entry.stateHash ? entries : [...entries, entry];
  return {
    schemaVersion: 1,
    project: 'SATA Reserve Token',
    purpose:
      'Append-only material-state ledger for reserve, distribution, liquidity, and metadata changes.',
    generatedAtUtc: report.generatedAtUtc,
    latestStateHash: nextEntries.at(-1)?.stateHash ?? null,
    entries: nextEntries
  };
}

function buildHistoryEntry(report) {
  const materialState = {
    btcReserveSats: report.bitcoinReserve.confirmedReserveSats,
    founderDirectPercent: report.distribution.founderDirectPercent,
    founderDirectRaw: report.distribution.founderDirectRaw,
    poolSataPercent: report.distribution.poolSataPercent,
    poolSataRaw: report.distribution.poolSataRaw,
    outsideFounderAndPoolPercent: report.distribution.outsideFounderAndPoolPercent,
    lockedLpRaw: report.liquidity.totalLockedLpRaw,
    ownerUnlockedLpRaw: report.liquidity.ownerUnlockedLpRaw,
    metadataUpdateAuthority: report.solana.metadataUpdateAuthority,
    metadataMutable: report.solana.metadataMutable,
    metadataUri: report.solana.metadataUri
  };
  return {
    observedAtUtc: report.generatedAtUtc,
    stateHash: hashJson(materialState),
    summary: {
      btcReserveSats: materialState.btcReserveSats,
      founderDirectPercent: materialState.founderDirectPercent,
      poolSataPercent: materialState.poolSataPercent,
      outsideFounderAndPoolPercent: materialState.outsideFounderAndPoolPercent,
      lockedLpRaw: materialState.lockedLpRaw,
      ownerUnlockedLpRaw: materialState.ownerUnlockedLpRaw,
      metadataUpdateAuthority: materialState.metadataUpdateAuthority,
      metadataMutable: materialState.metadataMutable,
      metadataUri: materialState.metadataUri
    },
    links: {
      reportJson: report.source.latestJson,
      repositoryCommit: `${report.source.repository}/commit/${report.source.commit}`,
      bitcoinReserveAddress: `https://mempool.space/address/${report.bitcoinReserve.address}`,
      solanaMint: report.links.mintExplorer,
      solanaMetadata: report.links.metadataExplorer,
      latestLpLockTransaction: report.liquidity.latestLockSignature
        ? `https://explorer.solana.com/tx/${report.liquidity.latestLockSignature}`
        : null,
      dexscreener: report.links.dexscreener,
      gmgn: report.links.gmgn
    }
  };
}

function buildHealthReport(report, history) {
  return {
    status: 'ok',
    project: 'SATA Reserve Token',
    generatedAtUtc: new Date().toISOString(),
    latestReportGeneratedAtUtc: report.generatedAtUtc,
    sourceCommit: report.source.commit,
    canonicalTransparencyUrl: report.source.transparencyPage,
    latestJson: report.source.latestJson,
    historyJson: report.source.historyJson,
    onChainMetadataUri: report.solana.metadataUri,
    expectedMetadataUri: TOKEN_METADATA_URL,
    reportAndMetadataUriMatch: report.solana.metadataUri === TOKEN_METADATA_URL,
    latestHistoryStateHash: history.latestStateHash,
    warnings: report.warnings
  };
}

function buildSitemap(report) {
  const urls = [
    `${PUBLIC_BASE_URL}/`,
    `${PUBLIC_BASE_URL}/services/transparency-audit`,
    `${PUBLIC_BASE_URL}/operations`,
    report.source.transparencyPage,
    `${PUBLIC_BASE_URL}/transparency/history`,
    report.source.latestJson,
    `${PUBLIC_BASE_URL}/transparency/latest.md`,
    report.source.historyJson,
    `${PUBLIC_BASE_URL}/transparency/history.md`,
    `${PUBLIC_BASE_URL}/project-profile.json`,
    `${PUBLIC_BASE_URL}/social-agent-profile.json`,
    `${PUBLIC_BASE_URL}/executive-approval-queue.json`,
    `${PUBLIC_BASE_URL}/reserve-growth-plan.json`,
    `${PUBLIC_BASE_URL}/revenue-operating-plan.json`,
    report.source.revenueCycleStatusJson,
    `${PUBLIC_BASE_URL}/sats-generation-ledger.json`,
    `${PUBLIC_BASE_URL}/sats-invoice-queue.json`,
    `${PUBLIC_BASE_URL}/sats-prospect-pipeline.json`,
    `${PUBLIC_BASE_URL}/transparency-audit-delivery-kit.json`,
    report.source.healthJson,
    `${PUBLIC_BASE_URL}/mainnet/sata-metadata.json`
  ];
  const urlEntries = urls
    .map(
      (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${escapeXml(report.generatedAtUtc)}</lastmod>
  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}

function buildRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${PUBLIC_BASE_URL}/sitemap.xml
`;
}

function buildMarkdownReport(report) {
  const pass = (value) => (value ? 'pass' : 'fail');
  const checks = report.checks
    .map((check) => `- ${check.name}: ${pass(check.ok)} (${check.level}) - ${check.detail}`)
    .join('\n');
  const warnings =
    report.warnings.length === 0
      ? '- none'
      : report.warnings.map((warning) => `- ${warning}`).join('\n');
  const lockRows =
    report.liquidity.lockTransactions.length === 0
      ? '- none found in scanned owner transaction window'
      : report.liquidity.lockTransactions
          .map(
            (lock) =>
              `- ${lock.signature}: ${lock.lockedLpAmountRaw} LP base units, verified=${lock.verified}`
          )
          .join('\n');

  return `# SATA Transparency Report

Status: ${report.status}
Generated UTC: ${report.generatedAtUtc}
Cadence: ${report.reportCadence}
Slogan: ${report.slogan}

This report is read-only. It does not request wallet signatures, spend SOL, upload secrets, or include full RPC URLs.

## Solana

- Network: ${report.network}
- RPC host: ${report.rpcHost}
- Owner: ${report.owner}
- SATA mint: ${report.solana.sataMint}
- Supply: ${report.solana.supplyUi} SATA (${report.solana.supplyRaw} base units)
- Launch initial supply: ${report.solana.launchInitialSupplyUi} SATA (${report.solana.launchInitialSupplyRaw} base units)
- Mint authority: ${report.solana.mintAuthority ?? 'revoked'}
- Freeze authority: ${report.solana.freezeAuthority ?? 'revoked'}
- Metadata: ${report.solana.metadataAddress}
- Metadata update authority: ${report.solana.metadataUpdateAuthority ?? 'unknown'}
- Metadata mutable: ${String(report.solana.metadataMutable)}
- Metadata URI: ${report.solana.metadataUri ?? 'unknown'}

## Liquidity

- DEX: ${report.liquidity.dex}
- Pair: ${report.liquidity.pair}
- Pool: ${report.liquidity.poolAddress}
- Pool program: ${report.liquidity.poolProgram}
- Pool open: ${String(report.liquidity.poolOpen)}
- SATA reserve: ${report.liquidity.sataReserveUi} (${report.liquidity.sataReserveRaw} base units)
- WSOL reserve: ${report.liquidity.wsolReserveUi} (${report.liquidity.wsolReserveLamports} lamports)
- LP mint: ${report.liquidity.lpMint}
- Total locked LP: ${report.liquidity.totalLockedLpRaw}
- Owner unlocked LP: ${report.liquidity.ownerUnlockedLpRaw}
- Lock status: ${report.liquidity.lockStatus}
- Removable by owner: ${String(report.liquidity.removable)}
- Disclosure: ${report.liquidity.lockDisclosure}

## Distribution

- Stage: ${report.distribution.stage}
- Founder role: ${report.distribution.founderRole}
- Founder public GitHub: ${report.distribution.founderPublicGithub}
- Founder direct SATA: ${report.distribution.founderDirectUi} (${report.distribution.founderDirectPercent})
- SATA in pool: ${report.distribution.poolSataUi} (${report.distribution.poolSataPercent})
- SATA outside founder wallet and pool: ${report.distribution.outsideFounderAndPoolUi} (${report.distribution.outsideFounderAndPoolPercent})
- Owner unlocked LP: ${report.distribution.ownerUnlockedLpRaw}
- Locked LP: ${report.distribution.totalLockedLpRaw}
- Control caveat: ${report.distribution.controlCaveat}
- Intended direction: ${report.distribution.intendedDirection}

## Raydium Lock Transactions

${lockRows}

## Bitcoin Reserve

- Status: ${report.bitcoinReserve.status}
- Address: ${report.bitcoinReserve.address ?? 'pending'}
- Actual reserve: ${report.bitcoinReserve.reserveSats ?? 'not verified'} sats (${report.bitcoinReserve.reserveBtc ?? 'not verified'} BTC)
- Confirmed reserve: ${report.bitcoinReserve.confirmedReserveSats ?? 'not verified'} sats (${report.bitcoinReserve.confirmedReserveBtc ?? 'not verified'} BTC)
- Unconfirmed reserve: ${report.bitcoinReserve.mempoolReserveSats ?? 'not verified'} sats (${report.bitcoinReserve.mempoolReserveBtc ?? 'not verified'} BTC)
- Planned reserve: ${report.bitcoinReserve.plannedReserveSats} sats (${report.bitcoinReserve.plannedReserveBtc} BTC)
- Metrics basis: ${report.bitcoinReserve.metricsBasis}
- Proof message: ${report.bitcoinReserve.proofMessage ?? 'not published'}
- Proof signature: ${report.bitcoinReserve.proofSignature ?? 'not published'}
- Proof validation: ${report.bitcoinReserve.proofValidation?.detail ?? 'not checked'}
- Sats per SATA: ${report.bitcoinReserve.satsPerSata}
- SATA per sat: ${report.bitcoinReserve.sataPerSat}
- Target for 1 sat per 1 SATA: ${report.bitcoinReserve.targetReserveSatsForOneSatPerSata} sats (${report.bitcoinReserve.targetReserveBtcForOneSatPerSata} BTC)
- Additional sats to that treasury milestone: ${report.bitcoinReserve.additionalSatsToOneSatPerSata}

${report.bitcoinReserve.caveat}

## GMGN

- Token page reference: ${report.gmgn.tokenPageReference}
- Status: ${report.gmgn.indexingStatus}

## DexScreener

- Pair page reference: ${report.dexscreener.pairPageReference}
- Token API reference: ${report.dexscreener.tokenApiReference}
- Status: ${report.dexscreener.indexingStatus}

## Warnings

${warnings}

## Checks

${checks}

## Links

- Mint explorer: ${report.links.mintExplorer}
- Pool explorer: ${report.links.poolExplorer}
- Metadata explorer: ${report.links.metadataExplorer}
- GMGN: ${report.links.gmgn}
- DexScreener: ${report.links.dexscreener}

## Permanent Caveats

${report.permanentCaveats.map((item) => `- ${item}`).join('\n')}
`;
}

function buildHistoryMarkdown(history) {
  const rows = history.entries
    .map(
      (entry) =>
        `| ${entry.observedAtUtc} | ${entry.summary.btcReserveSats} | ${entry.summary.founderDirectPercent} | ${entry.summary.poolSataPercent} | ${entry.summary.lockedLpRaw} | ${entry.summary.ownerUnlockedLpRaw} | ${entry.summary.metadataMutable} | ${entry.stateHash} |`
    )
    .join('\n');
  return `# SATA Material History

This append-only ledger records material reserve, distribution, liquidity, and metadata states when they change.

| Observed UTC | BTC reserve sats | Founder direct | Pool SATA | Locked LP raw | Owner unlocked LP raw | Metadata mutable | State hash |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${rows || '| none | 0 | 0% | 0% | 0 | 0 | unknown | none |'}
`;
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function readRequiredJson(path) {
  const value = await readJsonIfExists(path);
  if (!value) throw new Error(`Required JSON file is missing or invalid: ${path}`);
  return value;
}

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function getSourceCommit() {
  if (process.env.SOURCE_COMMIT) return process.env.SOURCE_COMMIT;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function rpc(method, params) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: requestId++, method, params })
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`${method} returned non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    if (response.ok && !payload.error) {
      return payload.result;
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`${method} failed: ${JSON.stringify(payload.error ?? payload)}`);
    }
    await sleep(500 * 2 ** (attempt - 1));
  }
  throw new Error(`${method} failed after retry budget.`);
}

async function getRawAccount(publicKey) {
  const result = await rpc('getAccountInfo', [
    publicKey,
    { commitment: 'confirmed', encoding: 'base64' }
  ]);
  if (!result.value) return null;
  return {
    owner: result.value.owner,
    lamports: result.value.lamports,
    data: result.value.data[0]
  };
}

async function getParsedAccount(publicKey) {
  const result = await rpc('getAccountInfo', [
    publicKey,
    { commitment: 'confirmed', encoding: 'jsonParsed' }
  ]);
  return result.value;
}

async function getTokenBalance(publicKey) {
  const account = await getRawAccount(publicKey);
  if (!account) return null;
  if (account.owner !== TOKEN_PROGRAM) {
    throw new Error(
      `Token account ${publicKey} is owned by ${account.owner}, expected ${TOKEN_PROGRAM}`
    );
  }
  const data = Buffer.from(account.data, 'base64');
  if (data.length < 72) {
    throw new Error(`Token account ${publicKey} is too short to decode: ${data.length} bytes`);
  }
  return {
    mint: publicKeyFromData(data, 0),
    owner: publicKeyFromData(data, 32),
    amount: data.readBigUInt64LE(64).toString()
  };
}

function decodeCpmmPool(data) {
  return {
    configId: publicKeyFromData(data, 8),
    poolCreator: publicKeyFromData(data, 40),
    vaultA: publicKeyFromData(data, 72),
    vaultB: publicKeyFromData(data, 104),
    lpMint: publicKeyFromData(data, 136),
    mintA: publicKeyFromData(data, 168),
    mintB: publicKeyFromData(data, 200),
    mintProgramA: publicKeyFromData(data, 232),
    mintProgramB: publicKeyFromData(data, 264),
    observationId: publicKeyFromData(data, 296),
    status: data[329],
    lpDecimals: data[330],
    mintDecimalA: data[331],
    mintDecimalB: data[332],
    openTimeUnix: data.readBigUInt64LE(373)
  };
}

function readMetadataSummary(base64Data) {
  const data = Buffer.from(base64Data, 'base64');
  try {
    let offset = 1;
    const updateAuthority = publicKeyFromData(data, offset);
    offset += 64;
    const nameField = readBorshString(data, offset);
    offset = nameField.nextOffset;
    const symbolField = readBorshString(data, offset);
    offset = symbolField.nextOffset;
    const uriField = readBorshString(data, offset);
    offset = uriField.nextOffset;
    offset += 2;
    const hasCreators = data[offset];
    offset += 1;
    if (hasCreators === 1) {
      const creatorCount = data.readUInt32LE(offset);
      offset += 4 + creatorCount * 34;
    }
    offset += 1;
    const mutableByte = data[offset];
    return {
      updateAuthority,
      mutable: mutableByte === 1 ? true : mutableByte === 0 ? false : 'unknown',
      name: cleanMetadataString(nameField.value),
      symbol: cleanMetadataString(symbolField.value),
      uri: cleanMetadataString(uriField.value)
    };
  } catch {
    return { updateAuthority: 'unknown', mutable: 'unknown', name: null, symbol: null, uri: null };
  }
}

function readBorshString(data, offset) {
  const length = data.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;
  return {
    value: data.subarray(start, end).toString('utf8'),
    nextOffset: end
  };
}

function cleanMetadataString(value) {
  const cleaned = value.replace(/\0+$/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

async function deriveAssociatedTokenAddress(owner, mint) {
  return derivePda(
    [publicKeyBytes(owner), publicKeyBytes(TOKEN_PROGRAM), publicKeyBytes(mint)],
    ASSOCIATED_TOKEN_PROGRAM
  );
}

async function deriveMetadataAddress(mint) {
  return derivePda(
    [Buffer.from('metadata'), publicKeyBytes(METADATA_PROGRAM), publicKeyBytes(mint)],
    METADATA_PROGRAM
  );
}

async function derivePda(seeds, programId) {
  return (
    await getProgramDerivedAddress({
      programAddress: address(programId),
      seeds
    })
  )[0];
}

function publicKeyBytes(publicKey) {
  return addressEncoder.encode(address(publicKey));
}

function publicKeyFromData(data, offset) {
  return addressDecoder.decode(data.subarray(offset, offset + 32));
}

function parseUnsignedBigInt(value, label) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a non-negative integer string.`);
  }
  return BigInt(value);
}

function parsePositiveInteger(value, label) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a positive integer string.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 1000) {
    throw new Error(`${label} must be a positive safe integer no greater than 1000.`);
  }
  return parsed;
}

function envValue(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseCsvEnv(value) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

async function loadLocalEnvFile(filename) {
  try {
    const text = await readFile(join(process.cwd(), filename), 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator <= 0) continue;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] ??= value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function ceilDiv(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

function reduceFraction(numerator, denominator) {
  if (denominator <= 0n)
    throw new Error('Cannot reduce a fraction with a non-positive denominator.');
  if (numerator === 0n) return { numerator: 0n, denominator: 1n };
  const divisor = gcd(
    numerator < 0n ? -numerator : numerator,
    denominator < 0n ? -denominator : denominator
  );
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function stringifyFraction(fraction) {
  return fraction.denominator === 1n
    ? fraction.numerator.toString()
    : `${fraction.numerator.toString()}/${fraction.denominator.toString()}`;
}

function gcd(left, right) {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function safeHost(url) {
  return new URL(url).host;
}

function joinUrl(base, path) {
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return new URL(path, normalized);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const report = await generateTransparencyReport();
  const outputs = await writeReports(report);
  console.log(
    JSON.stringify(
      {
        status: report.status,
        generatedAtUtc: report.generatedAtUtc,
        publicJson: outputs.publicJson,
        publicMarkdown: outputs.publicMarkdown,
        artifactJson: outputs.artifactJson,
        artifactMarkdown: outputs.artifactMarkdown,
        warnings: report.warnings
      },
      null,
      2
    )
  );
  if (report.status === 'VERIFICATION_INCOMPLETE') {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href && process.argv[1]) {
  const invoked = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === invoked) {
    await main();
  }
}
