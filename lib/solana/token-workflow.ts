import {
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Connection,
  type ParsedAccountData
} from '@solana/web3.js';
import { getCreateMetadataAccountV3InstructionDataSerializer } from '@metaplex-foundation/mpl-token-metadata';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { PROGRAM_IDS } from './constants';
import { PUBLIC_KEYS } from './public-keys';
import type { ValidatedTokenConfig } from '@/lib/validation/token-config';
import type { TransactionPreview } from '@/lib/security/transaction-preview';
import { validateTransactionPreview } from '@/lib/security/transaction-preview';

export type TokenLaunchPlan = {
  mint: Keypair | { publicKey: PublicKey };
  ata: PublicKey;
  metadata: PublicKey;
  transactions: Array<{ label: string; transaction: Transaction; preview: TransactionPreview }>;
};

export async function planTokenLaunch(params: {
  connection: Connection;
  owner: PublicKey;
  tokenConfig: ValidatedTokenConfig;
  metadataUri: string;
  network: string;
  latestBlockhash?: string;
}): Promise<TokenLaunchPlan> {
  const mint = Keypair.generate();
  const ata = getAssociatedTokenAddressSync(mint.publicKey, params.owner, false, TOKEN_PROGRAM_ID);
  const metadata = deriveMetadataAddress(mint.publicKey);
  const mintRent = BigInt(await getMinimumBalanceForRentExemptMint(params.connection));
  const ataRent = BigInt(
    await params.connection.getMinimumBalanceForRentExemption(165, 'confirmed')
  );
  const latestBlockhash =
    params.latestBlockhash ?? (await params.connection.getLatestBlockhash('confirmed')).blockhash;

  const createMintInstructions: TransactionInstruction[] = [
    SystemProgram.createAccount({
      fromPubkey: params.owner,
      newAccountPubkey: mint.publicKey,
      lamports: Number(mintRent),
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID
    }),
    createInitializeMint2Instruction(
      mint.publicKey,
      params.tokenConfig.decimals,
      params.owner,
      params.owner,
      TOKEN_PROGRAM_ID
    )
  ];

  const createAtaAndMintInstructions = [
    createAssociatedTokenAccountInstruction(params.owner, ata, params.owner, mint.publicKey),
    createMintToInstruction(
      mint.publicKey,
      ata,
      params.owner,
      params.tokenConfig.rawSupply,
      [],
      TOKEN_PROGRAM_ID
    )
  ];

  const metadataInstruction = buildMetadataPlaceholderInstruction(
    params.owner,
    mint.publicKey,
    params.metadataUri,
    params.tokenConfig,
    params.network
  );

  const tx1 = new Transaction().add(...createMintInstructions);
  tx1.feePayer = params.owner;
  tx1.recentBlockhash = latestBlockhash;
  tx1.partialSign(mint);

  const tx2 = new Transaction().add(...createAtaAndMintInstructions);
  tx2.feePayer = params.owner;
  tx2.recentBlockhash = latestBlockhash;

  const tx3 = new Transaction().add(metadataInstruction);
  tx3.feePayer = params.owner;
  tx3.recentBlockhash = latestBlockhash;

  const transactions = [
    {
      label: 'create-mint',
      transaction: tx1,
      preview: buildPreview({
        purpose: 'Create SATA mint account and initialize mint',
        network: params.network,
        owner: params.owner,
        programs: [PROGRAM_IDS.system, PROGRAM_IDS.splToken],
        newAccounts: [mint.publicKey.toBase58()],
        mint: mint.publicKey,
        amount: undefined,
        rent: mintRent,
        permanent: false,
        reversible: false
      })
    },
    {
      label: 'create-ata-and-mint-supply',
      transaction: tx2,
      preview: buildPreview({
        purpose: 'Create owner associated token account and mint fixed SATA supply',
        network: params.network,
        owner: params.owner,
        programs: [PROGRAM_IDS.associatedToken, PROGRAM_IDS.splToken],
        newAccounts: [ata.toBase58()],
        mint: mint.publicKey,
        amount: params.tokenConfig.rawSupply.toString(),
        rent: ataRent,
        permanent: false,
        reversible: false
      })
    },
    {
      label: 'create-metadata',
      transaction: tx3,
      preview: buildPreview({
        purpose: 'Create Metaplex token metadata for SATA',
        network: params.network,
        owner: params.owner,
        programs: [PROGRAM_IDS.metaplexTokenMetadata],
        newAccounts: [metadata.toBase58()],
        mint: mint.publicKey,
        amount: undefined,
        rent: 0n,
        permanent: false,
        reversible: true
      })
    }
  ];

  for (const item of transactions) validateTransactionPreview(item.preview);
  return { mint, ata, metadata, transactions };
}

export async function planExistingMintLaunchCompletion(params: {
  connection: Connection;
  owner: PublicKey;
  mint: PublicKey;
  tokenConfig: ValidatedTokenConfig;
  metadataUri: string;
  network: string;
  latestBlockhash?: string;
}): Promise<TokenLaunchPlan> {
  const mintAccount = await params.connection.getParsedAccountInfo(params.mint, 'confirmed');
  const mintInfo = mintAccount.value?.data;
  if (mintAccount.value?.owner.toBase58() !== PROGRAM_IDS.splToken || !isParsedAccountData(mintInfo)) {
    throw new Error('Existing mint is missing or is not owned by the SPL Token Program.');
  }

  const parsed = getMintParsedInfo(mintInfo);

  if (parsed?.decimals !== params.tokenConfig.decimals) {
    throw new Error(
      `Existing mint decimals ${String(parsed?.decimals)} do not match configured decimals ${params.tokenConfig.decimals}.`
    );
  }
  if (parsed.supply !== '0') {
    throw new Error(
      `Existing mint supply is ${String(parsed.supply)}. Recovery only supports a zero-supply mint controlled by the connected owner.`
    );
  }
  if (parsed.mintAuthority !== params.owner.toBase58()) {
    throw new Error(
      `Existing mint authority is ${parsed.mintAuthority ?? 'revoked'}, not the connected owner.`
    );
  }

  const ata = getAssociatedTokenAddressSync(params.mint, params.owner, false, TOKEN_PROGRAM_ID);
  const metadata = deriveMetadataAddress(params.mint);
  const ataRent = BigInt(
    await params.connection.getMinimumBalanceForRentExemption(165, 'confirmed')
  );
  const latestBlockhash =
    params.latestBlockhash ?? (await params.connection.getLatestBlockhash('confirmed')).blockhash;

  const createAtaAndMintInstructions = [
    createAssociatedTokenAccountIdempotentInstruction(
      params.owner,
      ata,
      params.owner,
      params.mint,
      TOKEN_PROGRAM_ID
    ),
    createMintToInstruction(
      params.mint,
      ata,
      params.owner,
      params.tokenConfig.rawSupply,
      [],
      TOKEN_PROGRAM_ID
    )
  ];

  const metadataInstruction = buildMetadataPlaceholderInstruction(
    params.owner,
    params.mint,
    params.metadataUri,
    params.tokenConfig,
    params.network
  );

  const tx1 = new Transaction().add(...createAtaAndMintInstructions);
  tx1.feePayer = params.owner;
  tx1.recentBlockhash = latestBlockhash;

  const tx2 = new Transaction().add(metadataInstruction);
  tx2.feePayer = params.owner;
  tx2.recentBlockhash = latestBlockhash;

  const transactions = [
    {
      label: 'create-ata-and-mint-supply',
      transaction: tx1,
      preview: buildPreview({
        purpose: 'Resume SATA launch by creating owner ATA and minting fixed supply',
        network: params.network,
        owner: params.owner,
        programs: [PROGRAM_IDS.associatedToken, PROGRAM_IDS.splToken],
        newAccounts: [ata.toBase58()],
        mint: params.mint,
        amount: params.tokenConfig.rawSupply.toString(),
        rent: ataRent,
        permanent: false,
        reversible: false
      })
    },
    {
      label: 'create-metadata',
      transaction: tx2,
      preview: buildPreview({
        purpose: 'Create Metaplex token metadata for resumed SATA mint',
        network: params.network,
        owner: params.owner,
        programs: [PROGRAM_IDS.metaplexTokenMetadata],
        newAccounts: [metadata.toBase58()],
        mint: params.mint,
        amount: undefined,
        rent: 0n,
        permanent: false,
        reversible: true
      })
    }
  ];

  for (const item of transactions) validateTransactionPreview(item.preview);
  return { mint: { publicKey: params.mint }, ata, metadata, transactions };
}

function isParsedAccountData(value: unknown): value is ParsedAccountData {
  return typeof value === 'object' && value !== null && 'parsed' in value;
}

type MintParsedInfo = {
  decimals?: number;
  supply?: string;
  mintAuthority?: string;
  freezeAuthority?: string;
};

function getMintParsedInfo(data: ParsedAccountData): MintParsedInfo {
  const parsed = data.parsed as unknown;
  if (typeof parsed !== 'object' || parsed === null || !('info' in parsed)) {
    throw new Error('Existing mint account did not contain parsed mint info.');
  }
  const info = parsed.info;
  if (typeof info !== 'object' || info === null) {
    throw new Error('Existing mint parsed info is malformed.');
  }
  const fields = info as Record<string, unknown>;
  const result: MintParsedInfo = {};
  if (typeof fields.decimals === 'number') result.decimals = fields.decimals;
  if (typeof fields.supply === 'string') result.supply = fields.supply;
  if (typeof fields.mintAuthority === 'string') result.mintAuthority = fields.mintAuthority;
  if (typeof fields.freezeAuthority === 'string') result.freezeAuthority = fields.freezeAuthority;
  return result;
}

export function deriveMetadataAddress(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      PUBLIC_KEYS.metaplexTokenMetadata.toBuffer(),
      mint.toBuffer()
    ],
    PUBLIC_KEYS.metaplexTokenMetadata
  )[0];
}

function buildMetadataPlaceholderInstruction(
  owner: PublicKey,
  mint: PublicKey,
  metadataUri: string,
  tokenConfig: ValidatedTokenConfig,
  network: string
): TransactionInstruction {
  const url = new URL(metadataUri);
  const isLocalDevnetUrl =
    url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url.protocol !== 'https:' && !(network !== 'mainnet-beta' && isLocalDevnetUrl)) {
    throw new Error('Metadata URI must be HTTPS, except localhost devnet-only testing metadata.');
  }
  const data = Buffer.from(
    getCreateMetadataAccountV3InstructionDataSerializer().serialize({
      data: {
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null
      },
      isMutable: true,
      collectionDetails: null
    })
  );

  return new TransactionInstruction({
    keys: [
      { pubkey: deriveMetadataAddress(mint), isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
    ],
    programId: PUBLIC_KEYS.metaplexTokenMetadata,
    data
  });
}

function buildPreview(params: {
  purpose: string;
  network: string;
  owner: PublicKey;
  programs: string[];
  newAccounts: string[];
  mint: PublicKey;
  amount: string | undefined;
  rent: bigint;
  permanent: boolean;
  reversible: boolean;
}): TransactionPreview {
  const preview: TransactionPreview = {
    purpose: params.purpose,
    network: params.network,
    feePayer: params.owner.toBase58(),
    programIds: params.programs,
    newAccounts: params.newAccounts,
    mintAddress: params.mint.toBase58(),
    mintAuthority: params.owner.toBase58(),
    freezeAuthority: params.owner.toBase58(),
    metadataUpdateAuthority: params.owner.toBase58(),
    estimatedNetworkFeeLamports: 5000n,
    estimatedRentLamports: params.rent,
    maxSpendLamports: params.rent + 20_000n,
    reversible: params.reversible,
    permanent: params.permanent,
    warnings: []
  };
  if (params.amount !== undefined) {
    preview.tokenAmount = params.amount;
  }
  return preview;
}
