import { address, getAddressEncoder, getProgramDerivedAddress, type Address } from '@solana/kit';
import { PROGRAM_IDS } from '@/lib/solana/constants';

export type RaydiumCpmmAddresses = {
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
};

export type ExistingRaydiumPool = {
  poolId: string;
  ownerProgramId: string;
  lamports: bigint;
};

export type AccountLookupResult = {
  ownerProgramId: string;
  lamports: bigint;
} | null;

export type RaydiumAccountLookup = (poolIds: readonly string[]) => Promise<AccountLookupResult[]>;

export async function deriveRaydiumCpmmAddresses(params: {
  mintA: string;
  mintB: string;
  feeConfigIndex: number;
  programId?: string;
}): Promise<RaydiumCpmmAddresses> {
  const programId = address(params.programId ?? PROGRAM_IDS.raydiumCpmmMainnet);
  const mintA = address(params.mintA);
  const mintB = address(params.mintB);
  const mintABytes = getAddressEncoder().encode(mintA);
  const mintBBytes = getAddressEncoder().encode(mintB);
  const configId = await derivePda(
    ['amm_config', encodeU16Be(params.feeConfigIndex)],
    programId
  );
  const poolId = await derivePda(
    ['pool', getAddressEncoder().encode(configId), mintABytes, mintBBytes],
    programId
  );
  const poolBytes = getAddressEncoder().encode(poolId);
  const authority = await derivePda(['vault_and_lp_mint_auth_seed'], programId);
  const lpMint = await derivePda(['pool_lp_mint', poolBytes], programId);
  const vaultA = await derivePda(['pool_vault', poolBytes, mintABytes], programId);
  const vaultB = await derivePda(['pool_vault', poolBytes, mintBBytes], programId);
  const observationId = await derivePda(['observation', poolBytes], programId);

  return {
    programId,
    configId,
    mintA,
    mintB,
    poolId,
    authority,
    lpMint,
    vaultA,
    vaultB,
    observationId
  };
}

export async function deriveRaydiumCpmmPairCandidates(params: {
  sataMint: string;
  quoteMint?: string;
  feeConfigIndex: number;
  programId?: string;
}): Promise<RaydiumCpmmAddresses[]> {
  const quoteMint = params.quoteMint ?? PROGRAM_IDS.wsolMint;
  const firstInput = {
    mintA: params.sataMint,
    mintB: quoteMint,
    feeConfigIndex: params.feeConfigIndex,
    ...(params.programId ? { programId: params.programId } : {})
  };
  const secondInput = {
    mintA: quoteMint,
    mintB: params.sataMint,
    feeConfigIndex: params.feeConfigIndex,
    ...(params.programId ? { programId: params.programId } : {})
  };
  const [first, second] = await Promise.all([
    deriveRaydiumCpmmAddresses(firstInput),
    deriveRaydiumCpmmAddresses(secondInput)
  ]);
  return first.poolId === second.poolId ? [first] : [first, second];
}

export async function detectExistingRaydiumCpmmPool(params: {
  accountLookup: RaydiumAccountLookup;
  sataMint: string;
  quoteMint?: string;
  feeConfigIndex: number;
  programId?: string;
}): Promise<ExistingRaydiumPool | null> {
  const programId = params.programId ?? PROGRAM_IDS.raydiumCpmmMainnet;
  const candidates = await deriveRaydiumCpmmPairCandidates(params);
  const accounts = await params.accountLookup(candidates.map((candidate) => candidate.poolId));

  for (const [index, account] of accounts.entries()) {
    if (!account) continue;
    if (account.ownerProgramId !== programId) continue;
    const candidate = candidates[index];
    if (!candidate) continue;
    return {
      poolId: candidate.poolId,
      ownerProgramId: account.ownerProgramId,
      lamports: account.lamports
    };
  }
  return null;
}

async function derivePda(
  seeds: Parameters<typeof getProgramDerivedAddress>[0]['seeds'],
  programAddress: Address
): Promise<Address> {
  return (
    await getProgramDerivedAddress({
      programAddress,
      seeds
    })
  )[0];
}

function encodeU16Be(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error('Raydium fee config index must be an unsigned 16-bit integer.');
  }
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setUint16(0, value, false);
  return new Uint8Array(buffer);
}
