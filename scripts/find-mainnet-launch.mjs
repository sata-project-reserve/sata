const RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://solana-rpc.publicnode.com';
const OWNER = process.argv[2];
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

let nextId = 1;

if (!OWNER) {
  console.error('Usage: node scripts/find-mainnet-launch.mjs <owner-public-address>');
  process.exit(1);
}

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params })
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${method} returned non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok || parsed.error) {
    throw new Error(`${method} failed: ${JSON.stringify(parsed.error ?? parsed)}`);
  }
  return parsed.result;
}

function collectInstructionAccounts(tx) {
  const accounts = new Set();
  const instructions = tx?.transaction?.message?.instructions ?? [];
  const inner = tx?.meta?.innerInstructions ?? [];
  for (const ix of instructions) {
    for (const account of ix.accounts ?? []) accounts.add(account);
  }
  for (const group of inner) {
    for (const ix of group.instructions ?? []) {
      for (const account of ix.accounts ?? []) accounts.add(account);
    }
  }
  return [...accounts];
}

function collectParsedInstructions(tx) {
  const out = [];
  for (const ix of tx?.transaction?.message?.instructions ?? []) out.push(ix);
  for (const group of tx?.meta?.innerInstructions ?? []) {
    for (const ix of group.instructions ?? []) out.push(ix);
  }
  return out;
}

function unixToIso(blockTime) {
  return blockTime ? new Date(blockTime * 1000).toISOString() : null;
}

const signatures = await rpc('getSignaturesForAddress', [
  OWNER,
  { limit: Number(process.env.SATA_SIGNATURE_SCAN_LIMIT ?? 50) }
]);

const candidates = [];
for (const item of signatures) {
  if (item.err) continue;
  const tx = await rpc('getTransaction', [
    item.signature,
    {
      commitment: 'confirmed',
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0
    }
  ]);
  if (!tx) continue;
  const instructions = collectParsedInstructions(tx);
  const tokenInstructions = instructions.filter((ix) => ix.programId === TOKEN_PROGRAM);
  const metadataInstructions = instructions.filter((ix) => ix.programId === METADATA_PROGRAM);
  const accounts = collectInstructionAccounts(tx);
  const parsedTypes = instructions
    .map((ix) => ix.parsed?.type)
    .filter(Boolean);
  const mintAddresses = new Set();
  for (const ix of tokenInstructions) {
    const info = ix.parsed?.info ?? {};
    for (const key of ['mint', 'mintAuthority', 'freezeAuthority']) {
      if (typeof info[key] === 'string' && info[key] !== OWNER) mintAddresses.add(info[key]);
    }
  }
  if (tokenInstructions.length > 0 || metadataInstructions.length > 0) {
    candidates.push({
      signature: item.signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      utc: unixToIso(tx.blockTime),
      fee: tx.meta?.fee,
      parsedTypes,
      tokenInstructionCount: tokenInstructions.length,
      metadataInstructionCount: metadataInstructions.length,
      possibleMints: [...mintAddresses],
      accounts
    });
  }
}

console.log(
  JSON.stringify(
    {
      rpcHost: new URL(RPC_URL).host,
      owner: OWNER,
      checkedSignatures: signatures.length,
      candidates
    },
    null,
    2
  )
);
