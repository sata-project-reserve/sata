import { existsSync, readFileSync } from 'node:fs';

const MANIFEST_PATH = 'launch-manifest.json';
const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const METAPLEX_TOKEN_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,88}$/;

if (!existsSync(MANIFEST_PATH)) {
  console.error('Devnet verification failed: launch-manifest.json is not present.');
  console.error('Run the owner-operated devnet workflow first, then rerun this script.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const checks = [];
let requestId = 1;

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Manifest field ${name} is required.`);
  }
  return value;
}

function requireBase58(value, name) {
  const text = requireString(value, name);
  if (!BASE58_PATTERN.test(text)) {
    throw new Error(`Manifest field ${name} is not a valid base58 string.`);
  }
  return text;
}

async function rpc(method, params) {
  const response = await fetch(DEVNET_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: requestId++,
      method,
      params
    })
  });
  if (!response.ok) {
    throw new Error(`RPC ${method} failed with HTTP ${response.status}.`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`RPC ${method} failed: ${payload.error.message ?? JSON.stringify(payload.error)}`);
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

try {
  if (manifest.network !== 'devnet') {
    throw new Error(`Expected devnet manifest, found ${String(manifest.network)}.`);
  }
  if (manifest.status !== 'TOKEN_CREATED') {
    throw new Error(`Expected TOKEN_CREATED status, found ${String(manifest.status)}.`);
  }

  const owner = requireBase58(manifest.ownerPublicAddress, 'ownerPublicAddress');
  const mint = requireBase58(manifest.mintAddress, 'mintAddress');
  const metadata = requireBase58(manifest.metadataAddress, 'metadataAddress');
  const ata = requireBase58(manifest.associatedTokenAccount, 'associatedTokenAccount');
  const expectedRawSupply = requireString(manifest.rawSupply, 'rawSupply');
  const expectedDecimals = Number(manifest.decimals);
  const expectsMintAuthorityRevoked = /revoked/i.test(
    String(manifest.mintAuthorityStatus ?? '')
  );
  const expectsFreezeAuthorityRevoked = /revoked/i.test(
    String(manifest.freezeAuthorityStatus ?? '')
  );

  if (!Number.isInteger(expectedDecimals) || expectedDecimals < 0 || expectedDecimals > 9) {
    throw new Error(`Invalid manifest decimals: ${String(manifest.decimals)}.`);
  }

  const [mintAccount, ataAccount, metadataAccount] = await Promise.all([
    getParsedAccount(mint),
    getParsedAccount(ata),
    getRawAccount(metadata)
  ]);

  const mintValue = mintAccount.value;
  const mintInfo = mintValue?.data?.parsed?.info;
  const ataValue = ataAccount.value;
  const ataInfo = ataValue?.data?.parsed?.info;
  const metadataValue = metadataAccount.value;

  record('mint-account-exists', mintValue !== null, mintValue ? mint : 'missing');
  record(
    'mint-token-program-owner',
    mintValue?.owner === SPL_TOKEN_PROGRAM_ID,
    mintValue?.owner ?? 'missing'
  );
  record('mint-initialized', mintInfo?.isInitialized === true, String(mintInfo?.isInitialized));
  record('decimals', mintInfo?.decimals === expectedDecimals, String(mintInfo?.decimals));
  record('total-supply', mintInfo?.supply === expectedRawSupply, String(mintInfo?.supply));
  record(
    'mint-authority-status',
    expectsMintAuthorityRevoked ? !mintInfo?.mintAuthority : mintInfo?.mintAuthority === owner,
    mintInfo?.mintAuthority ?? 'revoked'
  );
  record(
    'freeze-authority-status',
    expectsFreezeAuthorityRevoked
      ? !mintInfo?.freezeAuthority
      : mintInfo?.freezeAuthority === owner,
    mintInfo?.freezeAuthority ?? 'revoked'
  );
  record('ata-account-exists', ataValue !== null, ataValue ? ata : 'missing');
  record('ata-token-program-owner', ataValue?.owner === SPL_TOKEN_PROGRAM_ID, ataValue?.owner ?? 'missing');
  record('ata-mint', ataInfo?.mint === mint, ataInfo?.mint ?? 'missing');
  record('ata-owner', ataInfo?.owner === owner, ataInfo?.owner ?? 'missing');
  record(
    'ata-balance',
    ataInfo?.tokenAmount?.amount === expectedRawSupply,
    String(ataInfo?.tokenAmount?.amount)
  );
  record('metadata-account-exists', metadataValue !== null, metadataValue ? metadata : 'missing');
  record(
    'metadata-program-owner',
    metadataValue?.owner === METAPLEX_TOKEN_METADATA_PROGRAM_ID,
    metadataValue?.owner ?? 'missing'
  );

  const txEntries = Object.entries(manifest.transactionSignatures ?? {});
  const txSignatures = txEntries.map(([, signature]) =>
    requireBase58(signature, 'transactionSignatures.signature')
  );
  const txStatuses =
    txSignatures.length > 0
      ? await rpc('getSignatureStatuses', [
          txSignatures,
          {
            searchTransactionHistory: true
          }
        ])
      : { value: [] };

  txEntries.forEach(([label], index) => {
    const status = txStatuses.value?.[index] ?? null;
    const ok =
      status !== null &&
      !status.err &&
      (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized');
    record(`tx:${label}`, ok, status?.confirmationStatus ?? 'missing');
  });

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? 'pass' : 'fail'} ${check.name}: ${check.detail}`);
  }

  if (failed.length > 0) {
    console.error(`Independent devnet verification failed: ${failed.length} check(s) failed.`);
    process.exit(1);
  }

  console.log('Independent devnet verification passed.');
} catch (error) {
  console.error(`Independent devnet verification failed: ${error?.message ?? String(error)}`);
  process.exit(1);
}
