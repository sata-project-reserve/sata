import { createHash } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import bs58 from 'bs58';

const RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://solana-rpc.publicnode.com';
const OWNER = process.argv[2];
const MINT = process.argv[3];
const EXPECTED_DECIMALS = Number(process.env.SATA_EXPECTED_DECIMALS ?? '9');
const EXPECTED_SUPPLY = process.env.SATA_EXPECTED_RAW_SUPPLY ?? '1000000000000000000';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

let requestId = 1;
const checks = [];

if (!OWNER || !MINT) {
  console.error('Usage: node scripts/verify-mainnet-mint.mjs <owner-public-address> <mint-address>');
  process.exit(1);
}

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: requestId++, method, params })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`${method} failed: ${JSON.stringify(payload.error ?? payload)}`);
  }
  return payload.result;
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

async function getRawAccount(address) {
  return rpc('getAccountInfo', [
    address,
    {
      commitment: 'confirmed',
      encoding: 'base64'
    }
  ]);
}

function publicKeyBytes(address) {
  const bytes = Buffer.from(bs58.decode(address));
  if (bytes.length !== 32) throw new Error(`Invalid public key length for ${address}`);
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
  const buffer = Buffer.concat([...seeds, programIdBytes, marker]);
  const hash = createHash('sha256').update(buffer).digest();
  if (isOnCurve(hash)) throw new Error('Derived address is on curve.');
  return bs58.encode(hash);
}

function findProgramAddress(seeds, programId) {
  for (let bump = 255; bump >= 0; bump -= 1) {
    try {
      return createProgramAddress([...seeds, Buffer.from([bump])], programId);
    } catch {
      // Continue searching for an off-curve PDA.
    }
  }
  throw new Error('Unable to find program address.');
}

const associatedTokenAccount = findProgramAddress(
  [publicKeyBytes(OWNER), publicKeyBytes(TOKEN_PROGRAM), publicKeyBytes(MINT)],
  ASSOCIATED_TOKEN_PROGRAM
);
const metadataAddress = findProgramAddress(
  [Buffer.from('metadata'), publicKeyBytes(METADATA_PROGRAM), publicKeyBytes(MINT)],
  METADATA_PROGRAM
);

const [mintAccount, ataAccount, metadataAccount] = await Promise.all([
  getParsedAccount(MINT),
  getParsedAccount(associatedTokenAccount),
  getRawAccount(metadataAddress)
]);

const mintValue = mintAccount.value;
const mintInfo = mintValue?.data?.parsed?.info;
const ataValue = ataAccount.value;
const ataInfo = ataValue?.data?.parsed?.info;
const metadataValue = metadataAccount.value;

record('mint-account-exists', mintValue !== null, MINT);
record('mint-token-program-owner', mintValue?.owner === TOKEN_PROGRAM, mintValue?.owner ?? 'missing');
record('mint-initialized', mintInfo?.isInitialized === true, String(mintInfo?.isInitialized));
record('decimals', mintInfo?.decimals === EXPECTED_DECIMALS, String(mintInfo?.decimals));
record('total-supply', mintInfo?.supply === EXPECTED_SUPPLY, String(mintInfo?.supply));
record('mint-authority-revoked', !mintInfo?.mintAuthority, mintInfo?.mintAuthority ?? 'revoked');
record('freeze-authority-revoked', !mintInfo?.freezeAuthority, mintInfo?.freezeAuthority ?? 'revoked');
record('owner-ata-exists', ataValue !== null, associatedTokenAccount);
record('owner-ata-token-program-owner', ataValue?.owner === TOKEN_PROGRAM, ataValue?.owner ?? 'missing');
record('owner-token-account-mint', ataInfo?.mint === MINT, ataInfo?.mint ?? 'missing');
record('owner-token-account-owner', ataInfo?.owner === OWNER, ataInfo?.owner ?? 'missing');
record('owner-ata-balance', ataInfo?.tokenAmount?.amount === EXPECTED_SUPPLY, String(ataInfo?.tokenAmount?.amount));
record('metadata-account-exists', metadataValue !== null, metadataAddress ?? 'missing');
record(
  'metadata-program-owner',
  metadataValue?.owner === METADATA_PROGRAM,
  metadataValue?.owner ?? 'missing'
);

console.log(
  JSON.stringify(
    {
      rpcHost: new URL(RPC_URL).host,
      owner: OWNER,
      mint: MINT,
      associatedTokenAccount,
      metadata: metadataAddress,
      checks
    },
    null,
    2
  )
);

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`Mainnet mint verification failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log('Mainnet mint verification passed.');
