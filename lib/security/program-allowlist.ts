import { PROGRAM_IDS } from '@/lib/solana/constants';

export const ALLOWED_PROGRAM_IDS = new Set<string>([
  PROGRAM_IDS.system,
  PROGRAM_IDS.splToken,
  PROGRAM_IDS.token2022,
  PROGRAM_IDS.associatedToken,
  PROGRAM_IDS.metaplexTokenMetadata,
  PROGRAM_IDS.computeBudget,
  PROGRAM_IDS.raydiumCpmmMainnet,
  PROGRAM_IDS.raydiumCpmmLockMainnet
]);

export function assertAllowedProgramIds(programIds: readonly string[]): void {
  const denied = programIds.filter((programId) => !ALLOWED_PROGRAM_IDS.has(programId));
  if (denied.length > 0) {
    throw new Error(`Transaction contains unapproved program IDs: ${denied.join(', ')}`);
  }
}
