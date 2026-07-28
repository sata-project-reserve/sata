import {
  Transaction,
  type Connection,
  type PublicKey,
  type TransactionInstruction
} from '@solana/web3.js';
import {
  AuthorityType,
  createSetAuthorityInstruction,
  getMint,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import type { TransactionPreview } from '@/lib/security/transaction-preview';
import { PROGRAM_IDS } from './constants';
import { validateTransactionPreview } from '@/lib/security/transaction-preview';

export type AuthorityState = {
  mintAuthority: string | null;
  freezeAuthority: string | null;
};

export async function fetchAuthorityState(
  connection: Connection,
  mint: PublicKey
): Promise<AuthorityState> {
  const mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_PROGRAM_ID);
  return {
    mintAuthority: mintInfo.mintAuthority?.toBase58() ?? null,
    freezeAuthority: mintInfo.freezeAuthority?.toBase58() ?? null
  };
}

export function buildRevokeAuthorityTransaction(params: {
  owner: PublicKey;
  mint: PublicKey;
  authorityType: 'mint' | 'freeze';
  typedMintAddress: string;
  network: string;
}): { transaction: Transaction; preview: TransactionPreview } {
  if (params.typedMintAddress !== params.mint.toBase58()) {
    throw new Error('Typed mint address does not match the selected mint.');
  }

  const authority =
    params.authorityType === 'mint' ? AuthorityType.MintTokens : AuthorityType.FreezeAccount;
  const instruction: TransactionInstruction = createSetAuthorityInstruction(
    params.mint,
    params.owner,
    authority,
    null,
    [],
    TOKEN_PROGRAM_ID
  );
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = params.owner;

  const preview: TransactionPreview = {
    purpose:
      params.authorityType === 'mint'
        ? 'Permanently revoke SATA mint authority'
        : 'Permanently revoke SATA freeze authority',
    network: params.network,
    feePayer: params.owner.toBase58(),
    programIds: [PROGRAM_IDS.splToken],
    newAccounts: [],
    mintAddress: params.mint.toBase58(),
    estimatedNetworkFeeLamports: 5000n,
    estimatedRentLamports: 0n,
    maxSpendLamports: 10_000n,
    reversible: false,
    permanent: true,
    warnings: ['This authority revocation cannot be undone.']
  };
  validateTransactionPreview(preview);
  return { transaction, preview };
}
