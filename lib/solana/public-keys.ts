import { PublicKey } from '@solana/web3.js';
import { PROGRAM_IDS } from './constants';

export const PUBLIC_KEYS = Object.fromEntries(
  Object.entries(PROGRAM_IDS).map(([key, value]) => [key, new PublicKey(value)])
) as Record<keyof typeof PROGRAM_IDS, PublicKey>;
