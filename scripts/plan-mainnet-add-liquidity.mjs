import { createHash } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import bs58 from 'bs58';

const OWNER = 'HtDVYgAwWWzWWTSer1MtNVvJpZHhKjLo2Drzu2eARRaT';
const SATA_MINT = 'A4U9Z1tDcvf4gfAVpdsDEbZo67hw6rz2r5UVJ12RQzjH';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const POOL = 'CYRZoXLjgNFTQJnvyJpym1wfTAEoGz6kJMYJFb5hUd8e';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const RAYDIUM_CPMM = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';
const RPC_URL =
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL ??
  process.env.MAINNET_RPC_URL ??
  'https://solana-rpc.publicnode.com';

const solInput = process.argv[2] ?? '0.5';
let nextId = 1;

function parseSolToLamports(value) {
  if (!/^\d+(\.\d{1,9})?$/.test(value)) throw new Error('SOL amount must have up to 9 decimals.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'));
}

function formatBaseUnits(amount, decimals = 9) {
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`${method} failed: ${JSON.stringify(payload.error ?? payload)}`);
  }
  return payload.result;
}

function publicKeyBytes(address) {
  const bytes = Buffer.from(bs58.decode(address));
  if (bytes.length !== 32) throw new Error(`Invalid public key: ${address}`);
  return bytes;
}

function isOnCurve(bytes) {
  try {
    ed25519.Point.fromHex(bytes);
    return true;
  } catch {
    return false;
  }
}

function createProgramAddress(seeds, programId) {
  const programIdBytes = publicKeyBytes(programId);
  const marker = Buffer.from('ProgramDerivedAddress');
  const hash = createHash('sha256').update(Buffer.concat([...seeds, programIdBytes, marker])).digest();
  if (isOnCurve(hash)) throw new Error('Derived address is on curve.');
  return bs58.encode(hash);
}

function findProgramAddress(seeds, programId) {
  for (let bump = 255; bump >= 0; bump -= 1) {
    try {
      return createProgramAddress([...seeds, Buffer.from([bump])], programId);
    } catch {
      // Try next bump.
    }
  }
  throw new Error('Could not derive PDA.');
}

function decodePool(data) {
  const pubkey = (offset) => bs58.encode(data.subarray(offset, offset + 32));
  return {
    vaultA: pubkey(72),
    vaultB: pubkey(104),
    mintLp: pubkey(136),
    mintA: pubkey(168),
    mintB: pubkey(200)
  };
}

async function getRawAccount(address) {
  const result = await rpc('getAccountInfo', [
    address,
    { commitment: 'confirmed', encoding: 'base64' }
  ]);
  if (!result.value) throw new Error(`Account not found: ${address}`);
  return result.value;
}

async function getParsedAccount(address) {
  const result = await rpc('getAccountInfo', [
    address,
    { commitment: 'confirmed', encoding: 'jsonParsed' }
  ]);
  return result.value;
}

async function getTokenAmount(address) {
  const result = await rpc('getTokenAccountBalance', [address, { commitment: 'confirmed' }]);
  return BigInt(result.value.amount);
}

const solLamports = parseSolToLamports(solInput);
const poolAccount = await getRawAccount(POOL);
if (poolAccount.owner !== RAYDIUM_CPMM) {
  throw new Error(`Pool owner is ${poolAccount.owner}, expected Raydium CPMM.`);
}
const pool = decodePool(Buffer.from(poolAccount.data[0], 'base64'));
const sataVault = pool.mintA === SATA_MINT ? pool.vaultA : pool.vaultB;
const wsolVault = pool.mintA === WSOL_MINT ? pool.vaultA : pool.vaultB;
const [sataReserveRaw, wsolReserveLamports, ownerSolLamports] = await Promise.all([
  getTokenAmount(sataVault),
  getTokenAmount(wsolVault),
  rpc('getBalance', [OWNER, { commitment: 'confirmed' }]).then((result) => BigInt(result.value))
]);

const ownerSataAta = findProgramAddress(
  [publicKeyBytes(OWNER), publicKeyBytes(TOKEN_PROGRAM), publicKeyBytes(SATA_MINT)],
  ASSOCIATED_TOKEN_PROGRAM
);
const ownerLpAta = findProgramAddress(
  [publicKeyBytes(OWNER), publicKeyBytes(TOKEN_PROGRAM), publicKeyBytes(pool.mintLp)],
  ASSOCIATED_TOKEN_PROGRAM
);
const [ownerSataAccount, ownerLpAccount] = await Promise.all([
  getParsedAccount(ownerSataAta),
  getParsedAccount(ownerLpAta)
]);
const ownerSataRaw = BigInt(ownerSataAccount?.data?.parsed?.info?.tokenAmount?.amount ?? '0');
const ownerLpRaw = BigInt(ownerLpAccount?.data?.parsed?.info?.tokenAmount?.amount ?? '0');
const requiredSataRaw = (solLamports * sataReserveRaw + wsolReserveLamports - 1n) / wsolReserveLamports;
const totalMaxSolLamports = solLamports + 5_100_000n;

console.log(
  JSON.stringify(
    {
      rpcHost: new URL(RPC_URL).host,
      owner: OWNER,
      pool: POOL,
      sataMint: SATA_MINT,
      lpMint: pool.mintLp,
      sataVault,
      wsolVault,
      poolSataReserveRaw: sataReserveRaw.toString(),
      poolSataReserveUi: formatBaseUnits(sataReserveRaw),
      poolWsolReserveLamports: wsolReserveLamports.toString(),
      poolWsolReserveUi: formatBaseUnits(wsolReserveLamports),
      plannedSolLamports: solLamports.toString(),
      plannedSolUi: formatBaseUnits(solLamports),
      estimatedRequiredSataRaw: requiredSataRaw.toString(),
      estimatedRequiredSataUi: formatBaseUnits(requiredSataRaw),
      ownerSataAta,
      ownerSataRaw: ownerSataRaw.toString(),
      ownerSataUi: formatBaseUnits(ownerSataRaw),
      ownerLpAta,
      ownerUnlockedLpRawBeforeAdd: ownerLpRaw.toString(),
      ownerSolLamports: ownerSolLamports.toString(),
      ownerSolUi: formatBaseUnits(ownerSolLamports),
      estimatedMaxSolIncludingBufferLamports: totalMaxSolLamports.toString(),
      estimatedMaxSolIncludingBufferUi: formatBaseUnits(totalMaxSolLamports),
      enoughSata: ownerSataRaw >= requiredSataRaw,
      enoughSolBeforeReserve: ownerSolLamports >= totalMaxSolLamports,
      note: 'Raydium SDK will compute the exact paired SATA amount again from fresh reserves before wallet approval.'
    },
    null,
    2
  )
);
