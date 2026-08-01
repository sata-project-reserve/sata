import bs58 from 'bs58';

const OWNER = 'HtDVYgAwWWzWWTSer1MtNVvJpZHhKjLo2Drzu2eARRaT';
const SATA_MINT = 'A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const POOL = 'CYRZoXLjgNFTQJnvyJpym1wfTAEoGz6kJMYJFb5hUd8e';
const RAYDIUM_CPMM = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';
const RAYDIUM_LOCK = 'LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE';
const RAYDIUM_LOCK_AUTH = '3f7GcQFG397GAaEnv51zR6tsTVihYRydnydDD1cXekxH';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

const RPC_URL =
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL ??
  process.env.MAINNET_RPC_URL ??
  'https://solana-rpc.publicnode.com';

let requestId = 1;
const checks = [];

function record(name, pass, detail) {
  const check = { name, ok: Boolean(pass), detail: String(detail) };
  checks.push(check);
  console.log(`${check.ok ? 'pass' : 'fail'} ${check.name}: ${check.detail}`);
}

async function rpc(method, params) {
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
  if (!response.ok || payload.error) {
    throw new Error(`${method} failed: ${JSON.stringify(payload.error ?? payload)}`);
  }
  return payload.result;
}

async function getRawAccount(address) {
  return rpc('getAccountInfo', [
    address,
    {
      commitment: 'confirmed',
      encoding: 'base64'
    }
  ]);
}

async function getParsedAccount(address) {
  return rpc('getAccountInfo', [
    address,
    {
      commitment: 'confirmed',
      encoding: 'jsonParsed'
    }
  ]);
}

async function getTokenBalance(address) {
  return rpc('getTokenAccountBalance', [address, { commitment: 'confirmed' }]);
}

function publicKeyFromPoolData(data, offset) {
  return bs58.encode(data.subarray(offset, offset + 32));
}

function decodeCpmmPool(data) {
  return {
    configId: publicKeyFromPoolData(data, 8),
    poolCreator: publicKeyFromPoolData(data, 40),
    vaultA: publicKeyFromPoolData(data, 72),
    vaultB: publicKeyFromPoolData(data, 104),
    mintLp: publicKeyFromPoolData(data, 136),
    mintA: publicKeyFromPoolData(data, 168),
    mintB: publicKeyFromPoolData(data, 200),
    mintProgramA: publicKeyFromPoolData(data, 232),
    mintProgramB: publicKeyFromPoolData(data, 264),
    observationId: publicKeyFromPoolData(data, 296),
    status: data[329],
    lpDecimals: data[330],
    mintDecimalA: data[331],
    mintDecimalB: data[332]
  };
}

function parsedTokenInfo(account) {
  return account.value?.data?.parsed?.info;
}

function allInstructions(tx) {
  const out = [...(tx?.transaction?.message?.instructions ?? [])];
  for (const group of tx?.meta?.innerInstructions ?? []) {
    out.push(...(group.instructions ?? []));
  }
  return out;
}

async function findLockInstruction() {
  const signatures = await rpc('getSignaturesForAddress', [
    OWNER,
    { limit: Number(process.env.SATA_SIGNATURE_SCAN_LIMIT ?? 100), commitment: 'confirmed' }
  ]);
  for (const info of signatures) {
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
      return {
        signature: info.signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        accounts
      };
    }
  }
  throw new Error('No recent successful Raydium Burn & Earn lock transaction was found for the owner.');
}

const lock = await findLockInstruction();
const [
  auth,
  payer,
  liquidityOwner,
  nftOwner,
  nftMint,
  nftAccount,
  poolId,
  lockPda,
  mintLp,
  userLpVault,
  lockLpVault,
  poolVaultA,
  poolVaultB,
  metadataAccount
] = lock.accounts;

const [poolAccount, lockPdaAccount, lockVaultAccount, ownerLpAccount, feeKeyAccount] =
  await Promise.all([
    getRawAccount(POOL),
    getRawAccount(lockPda),
    getParsedAccount(lockLpVault),
    getParsedAccount(userLpVault),
    getParsedAccount(nftAccount)
  ]);

const poolData = Buffer.from(poolAccount.value.data[0], 'base64');
const poolState = decodeCpmmPool(poolData);
const lockVaultInfo = parsedTokenInfo(lockVaultAccount);
const ownerLpInfo = parsedTokenInfo(ownerLpAccount);
const feeKeyInfo = parsedTokenInfo(feeKeyAccount);
const [poolVaultABalance, poolVaultBBalance] = await Promise.all([
  getTokenBalance(poolVaultA),
  getTokenBalance(poolVaultB)
]);

record('lock-transaction-found', true, lock.signature);
record('lock-program-account', auth === RAYDIUM_LOCK_AUTH, auth);
record('fee-payer-owner', payer === OWNER, payer);
record('liquidity-owner', liquidityOwner === OWNER, liquidityOwner);
record('fee-key-owner-address', nftOwner === OWNER, nftOwner);
record('pool-account-owner', poolAccount.value?.owner === RAYDIUM_CPMM, poolAccount.value?.owner ?? 'missing');
record('pool-id', poolId === POOL, poolId);
record(
  'pool-mints',
  [poolState.mintA, poolState.mintB].includes(SATA_MINT) &&
    [poolState.mintA, poolState.mintB].includes(WSOL_MINT),
  `${poolState.mintA}, ${poolState.mintB}`
);
record(
  'pool-vaults-match-lock-instruction',
  [poolState.vaultA, poolState.vaultB].includes(poolVaultA) &&
    [poolState.vaultA, poolState.vaultB].includes(poolVaultB),
  `${poolVaultA}, ${poolVaultB}`
);
record('lp-mint-match', poolState.mintLp === mintLp, mintLp);
record('lock-pda-owner', lockPdaAccount.value?.owner === RAYDIUM_LOCK, lockPdaAccount.value?.owner ?? 'missing');
record('lock-lp-vault-token-program', lockVaultAccount.value?.owner === TOKEN_PROGRAM, lockVaultAccount.value?.owner ?? 'missing');
record('lock-lp-vault-owner', lockVaultInfo?.owner === RAYDIUM_LOCK_AUTH, lockVaultInfo?.owner ?? 'missing');
record('lock-lp-vault-mint', lockVaultInfo?.mint === mintLp, lockVaultInfo?.mint ?? 'missing');
record('locked-lp-amount-nonzero', BigInt(lockVaultInfo?.tokenAmount?.amount ?? '0') > 0n, lockVaultInfo?.tokenAmount?.amount ?? '0');
record('owner-lp-balance-zero', BigInt(ownerLpInfo?.tokenAmount?.amount ?? '0') === 0n, ownerLpInfo?.tokenAmount?.amount ?? '0');
record('fee-key-token-program', feeKeyAccount.value?.owner === TOKEN_PROGRAM, feeKeyAccount.value?.owner ?? 'missing');
record('fee-key-token-owner', feeKeyInfo?.owner === OWNER, feeKeyInfo?.owner ?? 'missing');
record('fee-key-token-mint', feeKeyInfo?.mint === nftMint, feeKeyInfo?.mint ?? 'missing');
record('fee-key-token-amount', feeKeyInfo?.tokenAmount?.amount === '1', feeKeyInfo?.tokenAmount?.amount ?? 'missing');
record('pool-vault-a-nonzero', BigInt(poolVaultABalance.value.amount) > 0n, poolVaultABalance.value.amount);
record('pool-vault-b-nonzero', BigInt(poolVaultBBalance.value.amount) > 0n, poolVaultBBalance.value.amount);

const verified = checks.every((check) => check.ok);
console.log(
  JSON.stringify(
    {
      verified,
      rpcHost: new URL(RPC_URL).host,
      signature: lock.signature,
      slot: lock.slot,
      blockTime: lock.blockTime ? new Date(lock.blockTime * 1000).toISOString() : null,
      owner: OWNER,
      sataMint: SATA_MINT,
      pool: POOL,
      lockProgram: RAYDIUM_LOCK,
      lockAuthority: RAYDIUM_LOCK_AUTH,
      lpMint: mintLp,
      lockPda,
      lockLpVault,
      feeKeyNftMint: nftMint,
      feeKeyNftAccount: nftAccount,
      feeKeyMetadata: metadataAccount,
      lockedLpAmountRaw: lockVaultInfo?.tokenAmount?.amount ?? '0',
      ownerLpBalanceRaw: ownerLpInfo?.tokenAmount?.amount ?? '0',
      poolVaultA,
      poolVaultB,
      poolVaultABalanceRaw: poolVaultABalance.value.amount,
      poolVaultBBalanceRaw: poolVaultBBalance.value.amount,
      checks
    },
    null,
    2
  )
);

if (!verified) {
  process.exitCode = 1;
}
