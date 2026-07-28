import { assertAllowedProgramIds } from './program-allowlist';

export type TransactionPreview = {
  purpose: string;
  network: string;
  feePayer: string;
  programIds: string[];
  newAccounts: string[];
  mintAddress?: string;
  tokenAmount?: string;
  mintAuthority?: string;
  freezeAuthority?: string;
  metadataUpdateAuthority?: string;
  estimatedNetworkFeeLamports: bigint;
  estimatedRentLamports: bigint;
  maxSpendLamports: bigint;
  reversible: boolean;
  permanent: boolean;
  warnings: string[];
};

export function validateTransactionPreview(preview: TransactionPreview): void {
  if (!preview.purpose.trim()) throw new Error('Transaction preview purpose is required.');
  if (!preview.network.trim()) throw new Error('Transaction preview network is required.');
  if (!preview.feePayer.trim()) throw new Error('Transaction preview fee payer is required.');
  assertAllowedProgramIds(preview.programIds);
  if (preview.maxSpendLamports < preview.estimatedNetworkFeeLamports + preview.estimatedRentLamports) {
    throw new Error('Maximum spend cannot be lower than estimated fee plus rent.');
  }
}
