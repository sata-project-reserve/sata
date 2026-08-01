import { Buffer } from 'buffer';
import {
  PublicKey,
  Transaction,
  type Connection,
  type VersionedTransaction
} from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import BN from 'bn.js';
import type {
  ApiCpmmConfigInfo,
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  Raydium as RaydiumSdk,
  TokenAccount,
  TokenAccountRaw
} from '@raydium-io/raydium-sdk-v2';
import { PROGRAM_IDS } from '@/lib/solana/constants';
import { deriveMetadataAddress } from '@/lib/solana/token-workflow';
import { fetchAuthorityState } from '@/lib/solana/authority';
import { enforceSpendingControls } from '@/lib/security/spending';
import {
  validateTransactionPreview,
  type TransactionPreview
} from '@/lib/security/transaction-preview';
import { buildPoolCreationPreview } from './planner';
import {
  deriveRaydiumCpmmPairCandidates,
  type RaydiumCpmmAddresses
} from './raydium-cpmm';
import type { LiquidityPlan, PoolCreationPreview, RaydiumPoolDisclosure } from './types';

type BufferGlobal = typeof globalThis & { Buffer?: typeof Buffer };
const globalWithBuffer = globalThis as BufferGlobal;
if (!globalWithBuffer.Buffer) {
  globalWithBuffer.Buffer = Buffer;
}

const RAYDIUM_CPMM_CONFIG_URL = 'https://api-v3.raydium.io/main/cpmm-config';
const RAYDIUM_POOL_BY_MINTS_URL = 'https://api-v3.raydium.io/pools/info/list-v2';
const RAYDIUM_POOL_RENT_BUFFER_LAMPORTS = 250_000_000n;
const POOL_NETWORK_FEE_BUFFER_LAMPORTS = 50_000n;
const LOCK_RENT_BUFFER_LAMPORTS = 25_000_000n;
export const LOCK_LIQUIDITY_CONFIRMATION_PHRASE = 'LOCK SATA LP FOREVER';

export type RaydiumPoolPreparedPreview = {
  poolPreview: PoolCreationPreview;
  transactionPreview: TransactionPreview;
  disclosure: RaydiumPoolDisclosure;
};

export type RaydiumPoolBuildResult = RaydiumPoolPreparedPreview & {
  transaction: Transaction | VersionedTransaction;
  instructionTypes: string[];
  localEphemeralSignerCount: number;
};

export type RaydiumAddLiquidityPreparedPreview = {
  transactionPreview: TransactionPreview;
  disclosure: RaydiumPoolDisclosure;
  expectedSataRawAmount: string;
  solLamports: string;
  expectedLpRawAmount: string;
};

export type RaydiumAddLiquidityBuildResult = RaydiumAddLiquidityPreparedPreview & {
  transaction: Transaction | VersionedTransaction;
  instructionTypes: string[];
  localEphemeralSignerCount: number;
};

export type RaydiumLockLiquidityPreparedPreview = {
  transactionPreview: TransactionPreview;
  disclosure: RaydiumPoolDisclosure;
  ownerLpAta: string;
  lpMint: string;
  lpAmountRaw: string;
  lockProgram: string;
  lockAuthority: string;
  irreversible: true;
};

export type RaydiumLockLiquidityBuildResult = RaydiumLockLiquidityPreparedPreview & {
  transaction: Transaction | VersionedTransaction;
  instructionTypes: string[];
  localEphemeralSignerCount: number;
};

export type RaydiumPoolVerification = {
  disclosure: RaydiumPoolDisclosure;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
};

export async function prepareRaydiumCpmmPoolPreview(params: {
  connection: Connection;
  owner: PublicKey;
  plan: LiquidityPlan;
  decimals: number;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
  metadataAddress?: string;
  fetchImpl?: typeof fetch;
}): Promise<RaydiumPoolPreparedPreview> {
  const sataMint = new PublicKey(params.plan.sataMint);
  const quoteMint = new PublicKey(params.plan.quoteMint);
  if (!quoteMint.equals(NATIVE_MINT)) {
    throw new Error('Only SATA/WSOL Raydium CPMM pools are enabled in this workflow.');
  }

  const sataRawAmount = parseBigIntString(params.plan.sataRawAmount, 'SATA liquidity amount');
  const solLamports = parseBigIntString(params.plan.solLamports, 'SOL liquidity amount');
  const configs = await fetchRaydiumCpmmConfigs(params.fetchImpl);
  const feeConfig = getRaydiumConfig(configs, params.plan.feeConfigIndex);
  const createPoolFeeLamports = parseBigIntString(feeConfig.createPoolFee, 'Raydium create-pool fee');
  const maxSpendLamports =
    solLamports +
    createPoolFeeLamports +
    RAYDIUM_POOL_RENT_BUFFER_LAMPORTS +
    POOL_NETWORK_FEE_BUFFER_LAMPORTS;

  const [balanceLamports, sataMintInfo, wsolMintInfo, authorityState] = await Promise.all([
    params.connection.getBalance(params.owner, 'confirmed').then(BigInt),
    getMint(params.connection, sataMint, 'confirmed', TOKEN_PROGRAM_ID),
    getMint(params.connection, quoteMint, 'confirmed', TOKEN_PROGRAM_ID),
    fetchAuthorityState(params.connection, sataMint)
  ]);
  if (sataMintInfo.decimals !== params.decimals) {
    throw new Error(`SATA mint decimals are ${sataMintInfo.decimals}, expected ${params.decimals}.`);
  }
  if (!sataMintInfo.address.equals(sataMint) || !wsolMintInfo.address.equals(quoteMint)) {
    throw new Error('SATA or WSOL mint account could not be verified.');
  }

  enforceSpendingControls({
    balanceLamports,
    estimatedLamports: maxSpendLamports,
    cumulativeLamports: 0n,
    maxBudgetLamports: params.maxBudgetLamports,
    reserveLamports: params.reserveLamports
  });

  const ownerSataAta = getAssociatedTokenAddressSync(sataMint, params.owner, false, TOKEN_PROGRAM_ID);
  const ownerSataAccount = await getAccount(
    params.connection,
    ownerSataAta,
    'confirmed',
    TOKEN_PROGRAM_ID
  );
  if (!ownerSataAccount.owner.equals(params.owner)) {
    throw new Error('Connected wallet does not own the SATA token account.');
  }
  if (ownerSataAccount.amount < sataRawAmount) {
    throw new Error(
      `Connected wallet has ${ownerSataAccount.amount.toString()} SATA base units, but ${sataRawAmount.toString()} are required for liquidity.`
    );
  }

  const duplicate = await detectExistingRaydiumCpmmPoolAcrossConfigs({
    connection: params.connection,
    sataMint: sataMint.toBase58(),
    quoteMint: quoteMint.toBase58(),
    configs
  });
  if (duplicate) {
    throw new Error(`A Raydium CPMM SATA/WSOL pool already exists at ${duplicate.poolId}.`);
  }

  const candidates = await deriveRaydiumCpmmPairCandidates({
    sataMint: sataMint.toBase58(),
    quoteMint: quoteMint.toBase58(),
    feeConfigIndex: feeConfig.index
  });
  const chosen = chooseSortedCandidate(candidates, sataMint, quoteMint);
  if (chosen.configId !== feeConfig.id) {
    throw new Error(
      `Raydium fee config mismatch. API returned ${feeConfig.id}, PDA derivation returned ${chosen.configId}.`
    );
  }

  const metadataAddress = params.metadataAddress ?? deriveMetadataAddress(sataMint).toBase58();
  const metadataSummary = await readMetadataSummary(params.connection, new PublicKey(metadataAddress));
  const ownerLpAta = getAssociatedTokenAddressSync(
    new PublicKey(chosen.lpMint),
    params.owner,
    false,
    TOKEN_PROGRAM_ID
  );
  const disclosure = buildDisclosure({
    candidate: chosen,
    owner: params.owner,
    ownerSataAta,
    ownerLpAta,
    feeConfig,
    sataRawAmount,
    solLamports,
    poolOpenTimeUnix: params.plan.poolOpenTimeUnix,
    mintAuthority: authorityState.mintAuthority,
    freezeAuthority: authorityState.freezeAuthority,
    metadataAddress,
    metadataUpdateAuthority: metadataSummary.updateAuthority,
    metadataMutable: metadataSummary.mutable,
    removable: true
  });

  const transactionPreview: TransactionPreview = {
    purpose: 'Create Raydium CPMM SATA/WSOL pool and deposit the configured initial liquidity',
    network: 'mainnet-beta',
    feePayer: params.owner.toBase58(),
    programIds: [
      PROGRAM_IDS.raydiumCpmmMainnet,
      PROGRAM_IDS.system,
      PROGRAM_IDS.splToken,
      PROGRAM_IDS.associatedToken
    ],
    newAccounts: [
      `Raydium pool ${chosen.poolId}`,
      `LP mint ${chosen.lpMint}`,
      `SATA vault ${disclosure.sataVault}`,
      `WSOL vault ${disclosure.wsolVault}`,
      `Owner LP ATA ${ownerLpAta.toBase58()}`
    ],
    mintAddress: sataMint.toBase58(),
    tokenAmount: sataRawAmount.toString(),
    mintAuthority: authorityState.mintAuthority ?? 'revoked',
    freezeAuthority: authorityState.freezeAuthority ?? 'revoked',
    metadataUpdateAuthority: metadataSummary.updateAuthority,
    estimatedNetworkFeeLamports: POOL_NETWORK_FEE_BUFFER_LAMPORTS,
    estimatedRentLamports: RAYDIUM_POOL_RENT_BUFFER_LAMPORTS + createPoolFeeLamports,
    maxSpendLamports,
    reversible: true,
    permanent: false,
    warnings: [
      'The initial ratio is chosen by the liquidity provider and is not evidence of market value.',
      'LP ownership remains removable unless a separate lock or burn transaction is later performed and verified.',
      'This action does not guarantee GMGN indexing or routing.'
    ]
  };
  validateTransactionPreview(transactionPreview);

  return {
    poolPreview: buildPoolCreationPreview(params.plan, true, candidates),
    transactionPreview,
    disclosure
  };
}

export async function buildRaydiumCpmmPoolTransaction(params: {
  connection: Connection;
  owner: PublicKey;
  plan: LiquidityPlan;
  decimals: number;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
  metadataAddress?: string;
}): Promise<RaydiumPoolBuildResult> {
  const prepared = await prepareRaydiumCpmmPoolPreview(params);
  const {
    Raydium,
    splAccountLayout,
    TxVersion,
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC
  } = await import('@raydium-io/raydium-sdk-v2');
  if (CREATE_CPMM_POOL_PROGRAM.toBase58() !== PROGRAM_IDS.raydiumCpmmMainnet) {
    throw new Error('Installed Raydium SDK CPMM program ID does not match the allowlist.');
  }
  const ownerTokenAccounts = await fetchOwnerSataTokenAccountForRaydium({
    connection: params.connection,
    owner: params.owner,
    sataMint: new PublicKey(params.plan.sataMint),
    ownerSataAta: new PublicKey(prepared.disclosure.ownerSataAta),
    decode: splAccountLayout.decode.bind(splAccountLayout)
  });

  const raydium = await Raydium.load({
    connection: params.connection,
    owner: params.owner,
    cluster: 'mainnet',
    disableFeatureCheck: true,
    disableLoadToken: true,
    tokenAccounts: ownerTokenAccounts.tokenAccounts,
    tokenAccountRawInfos: ownerTokenAccounts.tokenAccountRawInfos,
    notSubscribeAccountChange: true,
    blockhashCommitment: 'confirmed'
  });
  const feeConfigs = await raydium.api.getCpmmConfigs();
  const feeConfig = getRaydiumConfig(feeConfigs, params.plan.feeConfigIndex);
  if (feeConfig.id !== prepared.disclosure.configId) {
    throw new Error('Raydium fee config changed after preview. Prepare the pool preview again.');
  }

  const result = await raydium.cpmm.createPool({
    programId: CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC,
    mintA: {
      address: params.plan.sataMint,
      decimals: params.decimals,
      programId: TOKEN_PROGRAM_ID.toBase58()
    },
    mintB: {
      address: params.plan.quoteMint,
      decimals: 9,
      programId: TOKEN_PROGRAM_ID.toBase58()
    },
    mintAAmount: new BN(params.plan.sataRawAmount),
    mintBAmount: new BN(params.plan.solLamports),
    startTime: new BN(params.plan.poolOpenTimeUnix),
    feeConfig,
    associatedOnly: false,
    checkCreateATAOwner: true,
    ownerInfo: {
      feePayer: params.owner,
      useSOLBalance: true
    },
    feePayer: params.owner,
    txVersion: TxVersion.V0
  });

  validateRaydiumTransactionProgramIds(result.transaction);
  const address = result.extInfo.address;
  const sataIsAddressMintA = address.mintA.address === params.plan.sataMint;
  const disclosure: RaydiumPoolDisclosure = {
    ...prepared.disclosure,
    poolAddress: address.poolId.toBase58(),
    poolProgram: address.programId.toBase58(),
    poolFeeAccount: address.poolFeeAccount.toBase58(),
    configId: address.configId.toBase58(),
    mintA: address.mintA.address,
    mintB: address.mintB.address,
    lpMint: address.lpMint.toBase58(),
    sataVault: sataIsAddressMintA ? address.vaultA.toBase58() : address.vaultB.toBase58(),
    wsolVault: sataIsAddressMintA ? address.vaultB.toBase58() : address.vaultA.toBase58()
  };

  return {
    ...prepared,
    disclosure,
    transaction: result.transaction,
    instructionTypes: result.instructionTypes,
    localEphemeralSignerCount: result.signers.length
  };
}

export async function verifyRaydiumCpmmPool(params: {
  connection: Connection;
  owner: PublicKey;
  disclosure: RaydiumPoolDisclosure;
}): Promise<RaydiumPoolVerification> {
  const { CpmmPoolInfoLayout } = await import('@raydium-io/raydium-sdk-v2');
  const pool = new PublicKey(params.disclosure.poolAddress);
  const poolAccount = await params.connection.getAccountInfo(pool, 'confirmed');
  if (!poolAccount) {
    throw new Error('Raydium pool account was not found on-chain.');
  }
  const decoded = CpmmPoolInfoLayout.decode(poolAccount.data);
  const vaultA = decoded.vaultA.toBase58();
  const vaultB = decoded.vaultB.toBase58();
  const mintA = decoded.mintA.toBase58();
  const mintB = decoded.mintB.toBase58();
  const expectedSataMint =
    params.disclosure.mintA === PROGRAM_IDS.wsolMint
      ? params.disclosure.mintB
      : params.disclosure.mintA;
  const sataVault = mintA === expectedSataMint ? vaultA : vaultB;
  const wsolVault = mintA === PROGRAM_IDS.wsolMint ? vaultA : vaultB;
  const [vaultABalance, vaultBBalance] = await Promise.all([
    params.connection.getTokenAccountBalance(decoded.vaultA, 'confirmed'),
    params.connection.getTokenAccountBalance(decoded.vaultB, 'confirmed')
  ]);
  const sataReserveRaw =
    mintA === expectedSataMint
      ? BigInt(vaultABalance.value.amount)
      : BigInt(vaultBBalance.value.amount);
  const wsolReserveLamports =
    mintA === PROGRAM_IDS.wsolMint
      ? BigInt(vaultABalance.value.amount)
      : BigInt(vaultBBalance.value.amount);
  const ownerLpAta = getAssociatedTokenAddressSync(
    decoded.mintLp,
    params.owner,
    false,
    TOKEN_PROGRAM_ID
  );
  let ownerLpAmount = 0n;
  try {
    ownerLpAmount = BigInt(
      (await params.connection.getTokenAccountBalance(ownerLpAta, 'confirmed')).value.amount
    );
  } catch {
    ownerLpAmount = 0n;
  }
  const openTime = BigInt(decoded.openTime.toString());
  const poolOpen = openTime <= BigInt(Math.floor(Date.now() / 1000));
  const nextDisclosure: RaydiumPoolDisclosure = {
    ...params.disclosure,
    poolAddress: pool.toBase58(),
    poolProgram: poolAccount.owner.toBase58(),
    mintA,
    mintB,
    lpMint: decoded.mintLp.toBase58(),
    sataVault,
    wsolVault,
    ownerLpAta: ownerLpAta.toBase58(),
    removable: ownerLpAmount > 0n,
    lockBurnStatus:
      ownerLpAmount > 0n
        ? 'unlocked: owner LP token balance is present and removable unless separately locked or burned'
        : 'no owner LP token balance found; lock/burn not independently verified'
  };

  return {
    disclosure: nextDisclosure,
    checks: [
      {
        name: 'raydium-pool-account',
        ok: poolAccount.owner.toBase58() === PROGRAM_IDS.raydiumCpmmMainnet,
        detail: poolAccount.owner.toBase58()
      },
      {
        name: 'raydium-pool-mints',
        ok: [mintA, mintB].includes(PROGRAM_IDS.wsolMint) && [mintA, mintB].includes(expectedSataMint),
        detail: `${mintA}, ${mintB}`
      },
      {
        name: 'raydium-pool-vaults',
        ok: Boolean(sataVault && wsolVault),
        detail: `${sataVault}, ${wsolVault}`
      },
      {
        name: 'raydium-sata-reserve',
        ok: sataReserveRaw > 0n,
        detail: sataReserveRaw.toString()
      },
      {
        name: 'raydium-wsol-reserve',
        ok: wsolReserveLamports > 0n,
        detail: wsolReserveLamports.toString()
      },
      {
        name: 'raydium-pool-open',
        ok: poolOpen,
        detail: openTime.toString()
      },
      {
        name: 'owner-lp-position',
        ok: ownerLpAmount > 0n,
        detail: ownerLpAmount.toString()
      }
    ]
  };
}

export async function prepareRaydiumCpmmAddLiquidityPreview(params: {
  connection: Connection;
  owner: PublicKey;
  poolAddress?: string;
  sataMint: string;
  solLamports: bigint;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
}): Promise<RaydiumAddLiquidityPreparedPreview> {
  const { preview } = await buildAddLiquidityContext(params);
  return preview;
}

export async function buildRaydiumCpmmAddLiquidityTransaction(params: {
  connection: Connection;
  owner: PublicKey;
  poolAddress?: string;
  sataMint: string;
  solLamports: bigint;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
}): Promise<RaydiumAddLiquidityBuildResult> {
  const {
    Raydium,
    Percent,
    splAccountLayout,
    TxVersion
  } = await import('@raydium-io/raydium-sdk-v2');
  const { raydium, preview, poolInfo, poolKeys, solBaseIn } = await buildAddLiquidityContext({
    ...params,
    raydiumFactory: async () => {
      const ownerTokenAccounts = await fetchOwnerSataTokenAccountForRaydium({
        connection: params.connection,
        owner: params.owner,
        sataMint: new PublicKey(params.sataMint),
        ownerSataAta: getAssociatedTokenAddressSync(
          new PublicKey(params.sataMint),
          params.owner,
          false,
          TOKEN_PROGRAM_ID
        ),
        decode: splAccountLayout.decode.bind(splAccountLayout)
      });
      return Raydium.load({
        connection: params.connection,
        owner: params.owner,
        cluster: 'mainnet',
        disableFeatureCheck: true,
        disableLoadToken: true,
        tokenAccounts: ownerTokenAccounts.tokenAccounts,
        tokenAccountRawInfos: ownerTokenAccounts.tokenAccountRawInfos,
        notSubscribeAccountChange: true,
        blockhashCommitment: 'confirmed'
      });
    }
  });

  const result = await raydium.cpmm.addLiquidity({
    poolInfo,
    poolKeys,
    inputAmount: new BN(params.solLamports.toString()),
    baseIn: solBaseIn,
    slippage: new Percent(new BN(1), new BN(100)),
    config: {
      bypassAssociatedCheck: false,
      checkCreateATAOwner: true
    },
    txVersion: TxVersion.V0,
    feePayer: params.owner
  });
  validateRaydiumTransactionProgramIds(result.transaction);

  return {
    ...preview,
    transaction: result.transaction,
    instructionTypes: result.instructionTypes,
    localEphemeralSignerCount: result.signers.length
  };
}

export async function prepareRaydiumCpmmLockLiquidityPreview(params: {
  connection: Connection;
  owner: PublicKey;
  poolAddress?: string;
  sataMint: string;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
}): Promise<RaydiumLockLiquidityPreparedPreview> {
  const { preview } = await buildLockLiquidityContext(params);
  return preview;
}

export async function buildRaydiumCpmmLockLiquidityTransaction(params: {
  connection: Connection;
  owner: PublicKey;
  poolAddress?: string;
  sataMint: string;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
}): Promise<RaydiumLockLiquidityBuildResult> {
  const { Raydium, TxVersion, LOCK_CPMM_PROGRAM, LOCK_CPMM_AUTH } = await import(
    '@raydium-io/raydium-sdk-v2'
  );
  if (LOCK_CPMM_PROGRAM.toBase58() !== PROGRAM_IDS.raydiumCpmmLockMainnet) {
    throw new Error('Installed Raydium SDK LP-Lock program ID does not match the allowlist.');
  }
  if (LOCK_CPMM_AUTH.toBase58() !== PROGRAM_IDS.raydiumCpmmLockAuthorityMainnet) {
    throw new Error('Installed Raydium SDK LP-Lock authority does not match the expected address.');
  }

  const { raydium, preview, poolInfo, poolKeys } = await buildLockLiquidityContext({
    ...params,
    raydiumFactory: () =>
      Raydium.load({
        connection: params.connection,
        owner: params.owner,
        cluster: 'mainnet',
        disableFeatureCheck: true,
        disableLoadToken: true,
        notSubscribeAccountChange: true,
        blockhashCommitment: 'confirmed'
      })
  });

  const result = await raydium.cpmm.lockLp({
    poolInfo,
    poolKeys,
    lpAmount: new BN(preview.lpAmountRaw),
    programId: LOCK_CPMM_PROGRAM,
    authProgram: LOCK_CPMM_AUTH,
    feePayer: params.owner,
    feeNftOwner: params.owner,
    withMetadata: true,
    txVersion: TxVersion.V0
  });
  validateRaydiumTransactionProgramIds(result.transaction);

  const extInfo = result.extInfo as {
    nftMint: PublicKey;
    nftAccount: PublicKey;
    metadataAccount: PublicKey;
    lockPda: PublicKey;
    userLpVault: PublicKey;
    lockLpVault: PublicKey;
  };
  const disclosure: RaydiumPoolDisclosure = {
    ...preview.disclosure,
    lockProgram: PROGRAM_IDS.raydiumCpmmLockMainnet,
    lockAuthority: PROGRAM_IDS.raydiumCpmmLockAuthorityMainnet,
    lockPda: extInfo.lockPda.toBase58(),
    lockLpVault: extInfo.lockLpVault.toBase58(),
    feeKeyNftMint: extInfo.nftMint.toBase58(),
    feeKeyNftAccount: extInfo.nftAccount.toBase58(),
    lockedLpAmountRaw: preview.lpAmountRaw,
    lockBurnStatus:
      'pending permanent Raydium Burn & Earn lock; verify on-chain after MetaMask approval',
    removable: true
  };
  const transactionPreview: TransactionPreview = {
    ...preview.transactionPreview,
    newAccounts: [
      `Fee Key NFT mint ${extInfo.nftMint.toBase58()}`,
      `Fee Key NFT account ${extInfo.nftAccount.toBase58()}`,
      `Fee Key metadata ${extInfo.metadataAccount.toBase58()}`,
      `Burn & Earn lock PDA ${extInfo.lockPda.toBase58()}`,
      `Raydium LP-Lock vault ${extInfo.lockLpVault.toBase58()}`
    ]
  };
  validateTransactionPreview(transactionPreview);

  return {
    ...preview,
    transactionPreview,
    disclosure,
    transaction: result.transaction,
    instructionTypes: result.instructionTypes,
    localEphemeralSignerCount: result.signers.length
  };
}

export async function verifyRaydiumCpmmLiquidityLock(params: {
  connection: Connection;
  owner: PublicKey;
  disclosure: RaydiumPoolDisclosure;
  lockedLpAmountRaw?: string;
}): Promise<RaydiumPoolVerification> {
  const base = await verifyRaydiumCpmmPool(params);
  const expectedLockedAmount = parseBigIntString(
    params.lockedLpAmountRaw ?? params.disclosure.lockedLpAmountRaw ?? '0',
    'locked LP amount'
  );
  const lpMint = new PublicKey(base.disclosure.lpMint);
  const lockPda = params.disclosure.lockPda ? new PublicKey(params.disclosure.lockPda) : null;
  const lockLpVault = params.disclosure.lockLpVault
    ? new PublicKey(params.disclosure.lockLpVault)
    : null;
  const feeKeyNftMint = params.disclosure.feeKeyNftMint
    ? new PublicKey(params.disclosure.feeKeyNftMint)
    : null;
  const feeKeyNftAccount = params.disclosure.feeKeyNftAccount
    ? new PublicKey(params.disclosure.feeKeyNftAccount)
    : null;
  const lockProgram = PROGRAM_IDS.raydiumCpmmLockMainnet;
  const lockAuthority = new PublicKey(PROGRAM_IDS.raydiumCpmmLockAuthorityMainnet);

  const lockPdaAccount = lockPda
    ? await params.connection.getAccountInfo(lockPda, 'confirmed')
    : null;
  let lockVaultAmount = 0n;
  let lockVaultOwner = 'missing';
  let lockVaultMint = 'missing';
  if (lockLpVault) {
    try {
      const lockVaultAccount = await getAccount(
        params.connection,
        lockLpVault,
        'confirmed',
        TOKEN_PROGRAM_ID
      );
      lockVaultAmount = lockVaultAccount.amount;
      lockVaultOwner = lockVaultAccount.owner.toBase58();
      lockVaultMint = lockVaultAccount.mint.toBase58();
    } catch {
      lockVaultAmount = 0n;
    }
  }

  let ownerLpAmount = 0n;
  try {
    ownerLpAmount = BigInt(
      (await params.connection.getTokenAccountBalance(new PublicKey(base.disclosure.ownerLpAta), 'confirmed'))
        .value.amount
    );
  } catch {
    ownerLpAmount = 0n;
  }

  let feeKeyAmount = 0n;
  let feeKeyOwner = 'missing';
  let feeKeyMint = 'missing';
  if (feeKeyNftAccount) {
    try {
      const feeKeyAccount = await getAccount(
        params.connection,
        feeKeyNftAccount,
        'confirmed',
        TOKEN_PROGRAM_ID
      );
      feeKeyAmount = feeKeyAccount.amount;
      feeKeyOwner = feeKeyAccount.owner.toBase58();
      feeKeyMint = feeKeyAccount.mint.toBase58();
    } catch {
      feeKeyAmount = 0n;
    }
  }

  const lockChecks = [
    {
      name: 'raydium-lock-program',
      ok: lockPdaAccount?.owner.toBase58() === lockProgram,
      detail: lockPdaAccount?.owner.toBase58() ?? 'missing lock PDA'
    },
    {
      name: 'raydium-lock-lp-vault-owner',
      ok: lockVaultOwner === lockAuthority.toBase58() && lockVaultMint === lpMint.toBase58(),
      detail: `${lockVaultOwner}, ${lockVaultMint}`
    },
    {
      name: 'raydium-locked-lp-amount',
      ok: expectedLockedAmount > 0n && lockVaultAmount >= expectedLockedAmount,
      detail: lockVaultAmount.toString()
    },
    {
      name: 'fee-key-nft-owner',
      ok:
        feeKeyNftMint !== null &&
        feeKeyAmount === 1n &&
        feeKeyOwner === params.owner.toBase58() &&
        feeKeyMint === feeKeyNftMint.toBase58(),
      detail: `${feeKeyOwner}, ${feeKeyMint}, amount ${feeKeyAmount.toString()}`
    },
    {
      name: 'owner-lp-balance-after-lock',
      ok: ownerLpAmount === 0n,
      detail: ownerLpAmount.toString()
    }
  ];
  const locked = lockChecks.every((check) => check.ok);

  return {
    disclosure: {
      ...base.disclosure,
      ...params.disclosure,
      lockedLpAmountRaw: expectedLockedAmount.toString(),
      liquidityPositionOwner: params.owner.toBase58(),
      removable: !locked,
      lockBurnStatus: locked
        ? 'permanently locked via Raydium Burn & Earn; LP tokens are in Raydium LP-Lock escrow and cannot be withdrawn, while the Fee Key NFT controls fee claiming'
        : 'lock submitted but independent on-chain verification is incomplete'
    },
    checks: [
      ...base.checks.filter((check) => check.name !== 'owner-lp-position'),
      ...lockChecks
    ]
  };
}

async function buildLockLiquidityContext(params: {
  connection: Connection;
  owner: PublicKey;
  poolAddress?: string;
  sataMint: string;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
  raydiumFactory?: () => Promise<RaydiumSdk>;
}): Promise<{
  raydium: RaydiumSdk;
  poolInfo: ApiV3PoolInfoStandardItemCpmm;
  poolKeys: CpmmKeys;
  preview: RaydiumLockLiquidityPreparedPreview;
}> {
  const sataMint = new PublicKey(params.sataMint);
  const pool = await resolveExistingRaydiumPoolAddress({
    connection: params.connection,
    sataMint: sataMint.toBase58(),
    quoteMint: PROGRAM_IDS.wsolMint,
    ...(params.poolAddress ? { poolAddress: params.poolAddress } : {})
  });
  const estimatedLockSpendLamports = LOCK_RENT_BUFFER_LAMPORTS + POOL_NETWORK_FEE_BUFFER_LAMPORTS;

  const [balanceLamports, sataMintInfo, authorityState, poolAccount] = await Promise.all([
    params.connection.getBalance(params.owner, 'confirmed').then(BigInt),
    getMint(params.connection, sataMint, 'confirmed', TOKEN_PROGRAM_ID),
    fetchAuthorityState(params.connection, sataMint),
    params.connection.getAccountInfo(pool, 'confirmed')
  ]);
  if (!poolAccount || poolAccount.owner.toBase58() !== PROGRAM_IDS.raydiumCpmmMainnet) {
    throw new Error('Existing pool is not an allowlisted Raydium CPMM account.');
  }
  if (sataMintInfo.decimals !== 9) {
    throw new Error(`SATA mint decimals are ${sataMintInfo.decimals}, expected 9.`);
  }

  enforceSpendingControls({
    balanceLamports,
    estimatedLamports: estimatedLockSpendLamports,
    cumulativeLamports: 0n,
    maxBudgetLamports: params.maxBudgetLamports,
    reserveLamports: params.reserveLamports
  });

  const { Raydium } = await import('@raydium-io/raydium-sdk-v2');
  const raydium =
    params.raydiumFactory ??
    (() =>
      Raydium.load({
        connection: params.connection,
        owner: params.owner,
        cluster: 'mainnet',
        disableFeatureCheck: true,
        disableLoadToken: true,
        notSubscribeAccountChange: true,
        blockhashCommitment: 'confirmed'
      }));
  const sdk = await raydium();
  const { poolInfo, poolKeys } = await sdk.cpmm.getPoolInfoFromRpc(pool.toBase58());

  const mintAddresses = [poolInfo.mintA.address, poolInfo.mintB.address];
  if (!mintAddresses.includes(sataMint.toBase58()) || !mintAddresses.includes(PROGRAM_IDS.wsolMint)) {
    throw new Error('Existing pool is not the expected SATA/WSOL pair.');
  }
  if (poolInfo.programId !== PROGRAM_IDS.raydiumCpmmMainnet) {
    throw new Error('Existing pool program ID is not allowlisted for Raydium CPMM.');
  }

  const lpMint = new PublicKey(poolInfo.lpMint.address);
  const ownerLpAta = getAssociatedTokenAddressSync(lpMint, params.owner, false, TOKEN_PROGRAM_ID);
  const ownerLpAccount = await getAccount(
    params.connection,
    ownerLpAta,
    'confirmed',
    TOKEN_PROGRAM_ID
  );
  if (!ownerLpAccount.owner.equals(params.owner)) {
    throw new Error('Connected wallet does not own the Raydium LP token account.');
  }
  if (!ownerLpAccount.mint.equals(lpMint)) {
    throw new Error('Owner LP token account mint does not match the Raydium pool LP mint.');
  }
  if (ownerLpAccount.amount <= 0n) {
    throw new Error('No unlocked owner LP tokens were found to lock for this Raydium pool.');
  }

  const ownerSataAta = getAssociatedTokenAddressSync(sataMint, params.owner, false, TOKEN_PROGRAM_ID);
  const sataVault =
    poolInfo.mintA.address === sataMint.toBase58() ? poolKeys.vault.A : poolKeys.vault.B;
  const wsolVault =
    poolInfo.mintA.address === PROGRAM_IDS.wsolMint ? poolKeys.vault.A : poolKeys.vault.B;
  const metadataAddress = deriveMetadataAddress(sataMint).toBase58();
  const [metadataSummary, sataVaultBalance, wsolVaultBalance] = await Promise.all([
    readMetadataSummary(params.connection, new PublicKey(metadataAddress)),
    params.connection.getTokenAccountBalance(new PublicKey(sataVault), 'confirmed'),
    params.connection.getTokenAccountBalance(new PublicKey(wsolVault), 'confirmed')
  ]);

  const disclosure: RaydiumPoolDisclosure = {
    poolAddress: poolInfo.id,
    poolProgram: poolInfo.programId,
    poolFeeAccount: 'not used for LP lock',
    configId: poolInfo.config.id,
    feeConfigIndex: poolInfo.config.index,
    tradeFeeRate: poolInfo.config.tradeFeeRate.toString(),
    createPoolFeeLamports: '0',
    pair: 'SATA/WSOL',
    mintA: poolInfo.mintA.address,
    mintB: poolInfo.mintB.address,
    lpMint: lpMint.toBase58(),
    sataVault,
    wsolVault,
    ownerSataAta: ownerSataAta.toBase58(),
    ownerLpAta: ownerLpAta.toBase58(),
    sataDepositedRaw: sataVaultBalance.value.amount,
    wsolDepositedLamports: wsolVaultBalance.value.amount,
    poolOpeningTimestamp: poolInfo.openTime,
    mintAuthority: authorityState.mintAuthority,
    freezeAuthority: authorityState.freezeAuthority,
    metadataAddress,
    metadataUpdateAuthority: metadataSummary.updateAuthority,
    metadataMutable: metadataSummary.mutable,
    liquidityPositionOwner: params.owner.toBase58(),
    lockBurnStatus:
      'pending permanent Raydium Burn & Earn lock; owner LP tokens remain removable until the lock transaction is approved and verified',
    removable: true,
    lockProgram: PROGRAM_IDS.raydiumCpmmLockMainnet,
    lockAuthority: PROGRAM_IDS.raydiumCpmmLockAuthorityMainnet,
    lockedLpAmountRaw: ownerLpAccount.amount.toString()
  };
  const transactionPreview: TransactionPreview = {
    purpose:
      'Permanently lock all current owner Raydium CPMM LP tokens for the SATA/WSOL pool through Raydium Burn & Earn',
    network: 'mainnet-beta',
    feePayer: params.owner.toBase58(),
    programIds: [
      PROGRAM_IDS.raydiumCpmmLockMainnet,
      PROGRAM_IDS.system,
      PROGRAM_IDS.splToken,
      PROGRAM_IDS.associatedToken,
      PROGRAM_IDS.metaplexTokenMetadata
    ],
    newAccounts: [
      'Fee Key NFT mint generated at signing time',
      'Fee Key NFT associated token account',
      'Fee Key NFT metadata account',
      'Raydium Burn & Earn lock PDA',
      'Raydium LP-Lock vault for this LP mint'
    ],
    mintAddress: sataMint.toBase58(),
    tokenAmount: ownerLpAccount.amount.toString(),
    mintAuthority: authorityState.mintAuthority ?? 'revoked',
    freezeAuthority: authorityState.freezeAuthority ?? 'revoked',
    metadataUpdateAuthority: metadataSummary.updateAuthority,
    estimatedNetworkFeeLamports: POOL_NETWORK_FEE_BUFFER_LAMPORTS,
    estimatedRentLamports: LOCK_RENT_BUFFER_LAMPORTS,
    maxSpendLamports: estimatedLockSpendLamports,
    reversible: false,
    permanent: true,
    warnings: [
      'This permanently locks the current owner LP tokens; they cannot be withdrawn afterward.',
      'The Raydium Fee Key NFT controls fee-claim rights. Do not burn or transfer it unless that is an intentional separate decision.',
      'This is not a token-supply burn and it does not lock any future LP tokens received after this transaction.',
      'This action does not guarantee GMGN indexing, routing, price, or market value.'
    ]
  };
  validateTransactionPreview(transactionPreview);

  return {
    raydium: sdk,
    poolInfo,
    poolKeys,
    preview: {
      transactionPreview,
      disclosure,
      ownerLpAta: ownerLpAta.toBase58(),
      lpMint: lpMint.toBase58(),
      lpAmountRaw: ownerLpAccount.amount.toString(),
      lockProgram: PROGRAM_IDS.raydiumCpmmLockMainnet,
      lockAuthority: PROGRAM_IDS.raydiumCpmmLockAuthorityMainnet,
      irreversible: true
    }
  };
}

async function buildAddLiquidityContext(params: {
  connection: Connection;
  owner: PublicKey;
  poolAddress?: string;
  sataMint: string;
  solLamports: bigint;
  maxBudgetLamports: bigint;
  reserveLamports: bigint;
  raydiumFactory?: () => Promise<RaydiumSdk>;
}): Promise<{
  raydium: RaydiumSdk;
  poolInfo: ApiV3PoolInfoStandardItemCpmm;
  poolKeys: CpmmKeys;
  solBaseIn: boolean;
  preview: RaydiumAddLiquidityPreparedPreview;
}> {
  if (params.solLamports <= 0n) {
    throw new Error('Additional SOL liquidity must be greater than zero.');
  }
  const sataMint = new PublicKey(params.sataMint);
  const pool = await resolveExistingRaydiumPoolAddress({
    connection: params.connection,
    sataMint: sataMint.toBase58(),
    quoteMint: PROGRAM_IDS.wsolMint,
    ...(params.poolAddress ? { poolAddress: params.poolAddress } : {})
  });
  const ownerSataAta = getAssociatedTokenAddressSync(sataMint, params.owner, false, TOKEN_PROGRAM_ID);
  const maxSpendLamports = params.solLamports + 5_000_000n + POOL_NETWORK_FEE_BUFFER_LAMPORTS;

  const [balanceLamports, sataMintInfo, authorityState, poolAccount] = await Promise.all([
    params.connection.getBalance(params.owner, 'confirmed').then(BigInt),
    getMint(params.connection, sataMint, 'confirmed', TOKEN_PROGRAM_ID),
    fetchAuthorityState(params.connection, sataMint),
    params.connection.getAccountInfo(pool, 'confirmed')
  ]);
  if (!poolAccount || poolAccount.owner.toBase58() !== PROGRAM_IDS.raydiumCpmmMainnet) {
    throw new Error('Existing pool is not an allowlisted Raydium CPMM account.');
  }
  enforceSpendingControls({
    balanceLamports,
    estimatedLamports: maxSpendLamports,
    cumulativeLamports: 0n,
    maxBudgetLamports: params.maxBudgetLamports,
    reserveLamports: params.reserveLamports
  });

  const { Raydium, Percent } = await import('@raydium-io/raydium-sdk-v2');
  const raydium =
    params.raydiumFactory ??
    (() =>
      Raydium.load({
        connection: params.connection,
        owner: params.owner,
        cluster: 'mainnet',
        disableFeatureCheck: true,
        disableLoadToken: true,
        notSubscribeAccountChange: true,
        blockhashCommitment: 'confirmed'
      }));
  const sdk = await raydium();
  const { poolInfo, poolKeys, computePoolInfo } = await sdk.cpmm.getPoolInfoFromRpc(
    pool.toBase58()
  );

  const mintAddresses = [poolInfo.mintA.address, poolInfo.mintB.address];
  if (!mintAddresses.includes(sataMint.toBase58()) || !mintAddresses.includes(PROGRAM_IDS.wsolMint)) {
    throw new Error('Existing pool is not the expected SATA/WSOL pair.');
  }
  if (poolInfo.programId !== PROGRAM_IDS.raydiumCpmmMainnet) {
    throw new Error('Existing pool program ID is not allowlisted for Raydium CPMM.');
  }
  if (sataMintInfo.decimals !== 9) {
    throw new Error(`SATA mint decimals are ${sataMintInfo.decimals}, expected 9.`);
  }

  const solBaseIn = poolInfo.mintA.address === PROGRAM_IDS.wsolMint;
  const computeResult = sdk.cpmm.computePairAmount({
    poolInfo,
    baseReserve: computePoolInfo.baseReserve,
    quoteReserve: computePoolInfo.quoteReserve,
    slippage: new Percent(new BN(0)),
    baseIn: solBaseIn,
    epochInfo: await sdk.fetchEpochInfo(),
    amount: formatBaseUnitsAsDecimal(params.solLamports, 9)
  });
  const expectedSataRaw = BigInt(computeResult.anotherAmount.amount.toString());
  const ownerSataAccount = await getAccount(
    params.connection,
    ownerSataAta,
    'confirmed',
    TOKEN_PROGRAM_ID
  );
  if (!ownerSataAccount.owner.equals(params.owner)) {
    throw new Error('Connected wallet does not own the SATA token account.');
  }
  if (ownerSataAccount.amount < expectedSataRaw) {
    throw new Error(
      `Connected wallet has ${ownerSataAccount.amount.toString()} SATA base units, but ${expectedSataRaw.toString()} are needed to pair with this SOL amount.`
    );
  }

  const sataVault =
    poolInfo.mintA.address === sataMint.toBase58() ? poolKeys.vault.A : poolKeys.vault.B;
  const wsolVault =
    poolInfo.mintA.address === PROGRAM_IDS.wsolMint ? poolKeys.vault.A : poolKeys.vault.B;
  const lpMint = new PublicKey(poolInfo.lpMint.address);
  const ownerLpAta = getAssociatedTokenAddressSync(lpMint, params.owner, false, TOKEN_PROGRAM_ID);
  const metadataAddress = deriveMetadataAddress(sataMint).toBase58();
  const metadataSummary = await readMetadataSummary(params.connection, new PublicKey(metadataAddress));
  const disclosure: RaydiumPoolDisclosure = {
    poolAddress: poolInfo.id,
    poolProgram: poolInfo.programId,
    poolFeeAccount: 'not used for add-liquidity',
    configId: poolInfo.config.id,
    feeConfigIndex: poolInfo.config.index,
    tradeFeeRate: poolInfo.config.tradeFeeRate.toString(),
    createPoolFeeLamports: '0',
    pair: 'SATA/WSOL',
    mintA: poolInfo.mintA.address,
    mintB: poolInfo.mintB.address,
    lpMint: lpMint.toBase58(),
    sataVault,
    wsolVault,
    ownerSataAta: ownerSataAta.toBase58(),
    ownerLpAta: ownerLpAta.toBase58(),
    sataDepositedRaw: expectedSataRaw.toString(),
    wsolDepositedLamports: params.solLamports.toString(),
    poolOpeningTimestamp: poolInfo.openTime,
    mintAuthority: authorityState.mintAuthority,
    freezeAuthority: authorityState.freezeAuthority,
    metadataAddress,
    metadataUpdateAuthority: metadataSummary.updateAuthority,
    metadataMutable: metadataSummary.mutable,
    liquidityPositionOwner: params.owner.toBase58(),
    lockBurnStatus:
      'unlocked: added LP tokens remain with the owner unless a separate lock or burn transaction is later performed and verified',
    removable: true
  };
  const transactionPreview: TransactionPreview = {
    purpose: 'Add owner-approved liquidity to the existing Raydium CPMM SATA/WSOL pool',
    network: 'mainnet-beta',
    feePayer: params.owner.toBase58(),
    programIds: [
      PROGRAM_IDS.raydiumCpmmMainnet,
      PROGRAM_IDS.system,
      PROGRAM_IDS.splToken,
      PROGRAM_IDS.associatedToken
    ],
    newAccounts: [`Owner LP ATA ${ownerLpAta.toBase58()}`, 'Temporary WSOL account if needed'],
    mintAddress: sataMint.toBase58(),
    tokenAmount: expectedSataRaw.toString(),
    mintAuthority: authorityState.mintAuthority ?? 'revoked',
    freezeAuthority: authorityState.freezeAuthority ?? 'revoked',
    metadataUpdateAuthority: metadataSummary.updateAuthority,
    estimatedNetworkFeeLamports: POOL_NETWORK_FEE_BUFFER_LAMPORTS,
    estimatedRentLamports: 5_000_000n,
    maxSpendLamports,
    reversible: true,
    permanent: false,
    warnings: [
      'This adds liquidity; it is not a market buy.',
      'LP tokens remain removable by the owner unless separately locked or burned and independently verified.',
      'The SATA side is calculated from current pool reserves and may change before signing.'
    ]
  };
  validateTransactionPreview(transactionPreview);

  return {
    raydium: sdk,
    poolInfo,
    poolKeys,
    solBaseIn,
    preview: {
      transactionPreview,
      disclosure,
      expectedSataRawAmount: expectedSataRaw.toString(),
      solLamports: params.solLamports.toString(),
      expectedLpRawAmount: computeResult.liquidity.toString()
    }
  };
}

export async function resolveExistingRaydiumPoolAddress(params: {
  connection: Connection;
  poolAddress?: string;
  sataMint: string;
  quoteMint: string;
}): Promise<PublicKey> {
  if (params.poolAddress?.trim()) {
    try {
      const typedPool = new PublicKey(params.poolAddress.trim());
      const account = await params.connection.getAccountInfo(typedPool, 'confirmed');
      if (account?.owner.toBase58() === PROGRAM_IDS.raydiumCpmmMainnet) {
        return typedPool;
      }
    } catch {
      // Fall back to Raydium mint lookup below.
    }
  }

  const indexedPool = await fetchRaydiumPoolByMints(params.sataMint, params.quoteMint);
  const indexedPoolKey = new PublicKey(indexedPool);
  const indexedAccount = await params.connection.getAccountInfo(indexedPoolKey, 'confirmed');
  if (indexedAccount?.owner.toBase58() !== PROGRAM_IDS.raydiumCpmmMainnet) {
    throw new Error(
      `Raydium reported pool ${indexedPool}, but the on-chain account is not owned by the allowlisted CPMM program.`
    );
  }
  return indexedPoolKey;
}

async function fetchRaydiumPoolByMints(sataMint: string, quoteMint: string): Promise<string> {
  const url = new URL(RAYDIUM_POOL_BY_MINTS_URL);
  url.searchParams.set('size', '100');
  url.searchParams.set('mint1', sataMint);
  url.searchParams.set('mint2', quoteMint);
  const response = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Raydium pool lookup failed with HTTP ${response.status}.`);
  }
  const body = (await response.json()) as {
    success?: boolean;
    data?: {
      data?: Array<{
        id?: string;
        programId?: string;
        pooltype?: string[];
        mintA?: { address?: string };
        mintB?: { address?: string };
      }>;
    };
  };
  const pool = body.data?.data?.find(
    (item) =>
      body.success === true &&
      item.id &&
      item.programId === PROGRAM_IDS.raydiumCpmmMainnet &&
      item.pooltype?.includes('Cpmm') &&
      [item.mintA?.address, item.mintB?.address].includes(sataMint) &&
      [item.mintA?.address, item.mintB?.address].includes(quoteMint)
  );
  if (!pool?.id) {
    throw new Error('No Raydium CPMM SATA/WSOL pool was found by mint lookup.');
  }
  return pool.id;
}

async function fetchRaydiumCpmmConfigs(fetchImpl: typeof fetch = fetch): Promise<ApiCpmmConfigInfo[]> {
  const response = await fetchImpl(RAYDIUM_CPMM_CONFIG_URL, {
    headers: { accept: 'application/json' },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`Raydium CPMM config request failed with HTTP ${response.status}.`);
  }
  const body = (await response.json()) as { success?: boolean; data?: ApiCpmmConfigInfo[] };
  if (body.success !== true || !Array.isArray(body.data)) {
    throw new Error('Raydium CPMM config response was invalid.');
  }
  return body.data;
}

function getRaydiumConfig(
  configs: readonly ApiCpmmConfigInfo[],
  feeConfigIndex: number
): ApiCpmmConfigInfo {
  const feeConfig = configs.find((config) => config.index === feeConfigIndex);
  if (!feeConfig) {
    throw new Error(`Raydium CPMM fee config index ${feeConfigIndex} was not found.`);
  }
  return feeConfig;
}

async function detectExistingRaydiumCpmmPoolAcrossConfigs(params: {
  connection: Connection;
  sataMint: string;
  quoteMint: string;
  configs: readonly ApiCpmmConfigInfo[];
}): Promise<{ poolId: string } | null> {
  const nestedCandidates = await Promise.all(
    params.configs.map((config) =>
      deriveRaydiumCpmmPairCandidates({
        sataMint: params.sataMint,
        quoteMint: params.quoteMint,
        feeConfigIndex: config.index
      })
    )
  );
  const candidates = nestedCandidates.flat();
  for (const candidate of candidates) {
    const account = await params.connection.getAccountInfo(
      new PublicKey(candidate.poolId),
      'confirmed'
    );
    if (account?.owner.toBase58() === PROGRAM_IDS.raydiumCpmmMainnet) {
      return { poolId: candidate.poolId };
    }
  }
  return null;
}

function chooseSortedCandidate(
  candidates: readonly RaydiumCpmmAddresses[],
  sataMint: PublicKey,
  quoteMint: PublicKey
): RaydiumCpmmAddresses {
  const [mintA, mintB] =
    comparePublicKeyBytes(sataMint, quoteMint) <= 0
      ? [sataMint.toBase58(), quoteMint.toBase58()]
      : [quoteMint.toBase58(), sataMint.toBase58()];
  const candidate = candidates.find((item) => item.mintA === mintA && item.mintB === mintB);
  if (!candidate) {
    throw new Error('Could not derive the Raydium CPMM pool candidate for the sorted mint pair.');
  }
  return candidate;
}

function comparePublicKeyBytes(left: PublicKey, right: PublicKey): number {
  return Buffer.compare(left.toBuffer(), right.toBuffer());
}

function buildDisclosure(params: {
  candidate: RaydiumCpmmAddresses;
  owner: PublicKey;
  ownerSataAta: PublicKey;
  ownerLpAta: PublicKey;
  feeConfig: ApiCpmmConfigInfo;
  sataRawAmount: bigint;
  solLamports: bigint;
  poolOpenTimeUnix: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  metadataAddress: string;
  metadataUpdateAuthority: string;
  metadataMutable: boolean | 'unknown';
  removable: boolean;
}): RaydiumPoolDisclosure {
  return {
    poolAddress: params.candidate.poolId,
    poolProgram: params.candidate.programId,
    poolFeeAccount: 'resolved from Raydium SDK at signing time',
    configId: params.candidate.configId,
    feeConfigIndex: params.feeConfig.index,
    tradeFeeRate: params.feeConfig.tradeFeeRate.toString(),
    createPoolFeeLamports: params.feeConfig.createPoolFee,
    pair: 'SATA/WSOL',
    mintA: params.candidate.mintA,
    mintB: params.candidate.mintB,
    lpMint: params.candidate.lpMint,
    sataVault:
      params.candidate.mintA === PROGRAM_IDS.wsolMint
        ? params.candidate.vaultB
        : params.candidate.vaultA,
    wsolVault:
      params.candidate.mintA === PROGRAM_IDS.wsolMint
        ? params.candidate.vaultA
        : params.candidate.vaultB,
    ownerSataAta: params.ownerSataAta.toBase58(),
    ownerLpAta: params.ownerLpAta.toBase58(),
    sataDepositedRaw: params.sataRawAmount.toString(),
    wsolDepositedLamports: params.solLamports.toString(),
    poolOpeningTimestamp: params.poolOpenTimeUnix,
    mintAuthority: params.mintAuthority,
    freezeAuthority: params.freezeAuthority,
    metadataAddress: params.metadataAddress,
    metadataUpdateAuthority: params.metadataUpdateAuthority,
    metadataMutable: params.metadataMutable,
    liquidityPositionOwner: params.owner.toBase58(),
    lockBurnStatus:
      'unlocked: LP tokens remain with the owner unless a separate lock or burn transaction is later performed and verified',
    removable: params.removable
  };
}

async function readMetadataSummary(
  connection: Connection,
  metadataAddress: PublicKey
): Promise<{ updateAuthority: string; mutable: boolean | 'unknown' }> {
  const account = await connection.getAccountInfo(metadataAddress, 'confirmed');
  if (!account) return { updateAuthority: 'metadata account not found', mutable: 'unknown' };
  try {
    let offset = 1;
    const updateAuthority = new PublicKey(account.data.subarray(offset, offset + 32)).toBase58();
    offset += 64;
    offset = skipBorshString(account.data, offset);
    offset = skipBorshString(account.data, offset);
    offset = skipBorshString(account.data, offset);
    offset += 2;
    const hasCreators = account.data[offset];
    offset += 1;
    if (hasCreators === 1) {
      const creatorCount = account.data.readUInt32LE(offset);
      offset += 4 + creatorCount * 34;
    }
    offset += 1;
    const mutableByte = account.data[offset];
    return {
      updateAuthority,
      mutable: mutableByte === 1 ? true : mutableByte === 0 ? false : 'unknown'
    };
  } catch {
    return { updateAuthority: 'unknown', mutable: 'unknown' };
  }
}

async function fetchOwnerSataTokenAccountForRaydium(params: {
  connection: Connection;
  owner: PublicKey;
  sataMint: PublicKey;
  ownerSataAta: PublicKey;
  decode: (data: Buffer) => TokenAccountRaw['accountInfo'];
}): Promise<{ tokenAccounts: TokenAccount[]; tokenAccountRawInfos: TokenAccountRaw[] }> {
  const account = await params.connection.getAccountInfo(params.ownerSataAta, 'confirmed');
  if (!account) {
    throw new Error('Owner SATA token account was not found while building the Raydium transaction.');
  }
  if (!account.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error('Owner SATA token account is not owned by the standard SPL Token Program.');
  }

  const decoded = params.decode(Buffer.from(account.data));
  if (!decoded.mint.equals(params.sataMint)) {
    throw new Error('Owner SATA token account mint changed before Raydium transaction build.');
  }
  if (!decoded.owner.equals(params.owner)) {
    throw new Error('Connected wallet no longer controls the SATA token account.');
  }

  const tokenAccount: TokenAccount = {
    publicKey: params.ownerSataAta,
    mint: decoded.mint,
    amount: decoded.amount,
    isAssociated: true,
    isNative: false,
    programId: account.owner
  };
  const tokenAccountRaw: TokenAccountRaw = {
    programId: account.owner,
    pubkey: params.ownerSataAta,
    accountInfo: decoded
  };
  return {
    tokenAccounts: [tokenAccount],
    tokenAccountRawInfos: [tokenAccountRaw]
  };
}

function skipBorshString(data: Buffer, offset: number): number {
  const length = data.readUInt32LE(offset);
  return offset + 4 + length;
}

function validateRaydiumTransactionProgramIds(transaction: Transaction | VersionedTransaction): void {
  const programIds =
    transaction instanceof Transaction
      ? transaction.instructions.map((instruction) => instruction.programId.toBase58())
      : transaction.message.compiledInstructions.map((instruction) => {
          const key = transaction.message.staticAccountKeys[instruction.programIdIndex];
          if (!key) {
            throw new Error('Raydium transaction uses a non-static program ID; refusing to sign.');
          }
          return key.toBase58();
        });

  validateTransactionPreview({
    purpose: 'Validate Raydium CPMM transaction program IDs before wallet approval',
    network: 'mainnet-beta',
    feePayer: 'owner',
    programIds,
    newAccounts: [],
    estimatedNetworkFeeLamports: 0n,
    estimatedRentLamports: 0n,
    maxSpendLamports: 0n,
    reversible: true,
    permanent: false,
    warnings: []
  });
}

function parseBigIntString(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a non-negative integer string.`);
  }
  return BigInt(value);
}

function formatBaseUnitsAsDecimal(amount: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}
