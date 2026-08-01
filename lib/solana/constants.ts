export const LAMPORTS_PER_SOL_BIGINT = 1_000_000_000n;

export const CLUSTERS = ['readonly', 'devnet', 'testnet', 'mainnet-beta'] as const;
export type AppCluster = (typeof CLUSTERS)[number];

export const SATA_DEFAULTS = {
  name: 'SATA',
  symbol: 'SATA',
  description:
    'SATA is a community-driven experimental token on Solana. It provides no promise of profit, return, utility or appreciation.',
  decimals: 9,
  supply: '1000000000',
  imageUri: 'http://127.0.0.1:3001/sata-default.svg',
  website: '',
  xUrl: '',
  telegramUrl: '',
  metadataUri: 'http://127.0.0.1:3001/sata-devnet-metadata.json',
  tokenProgram: 'spl-token',
  network: 'devnet'
} as const;

export const PROGRAM_IDS = {
  system: '11111111111111111111111111111111',
  splToken: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  token2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  associatedToken: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  metaplexTokenMetadata: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  computeBudget: 'ComputeBudget111111111111111111111111111111',
  raydiumCpmmMainnet: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  raydiumCpmmLockMainnet: 'LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE',
  raydiumCpmmLockAuthorityMainnet: '3f7GcQFG397GAaEnv51zR6tsTVihYRydnydDD1cXekxH',
  wsolMint: 'So11111111111111111111111111111111111111112'
} as const;

export const SUPPORTED_SOLANA_CHAINS = {
  devnet: 'solana:devnet',
  'mainnet-beta': 'solana:mainnet',
  testnet: 'solana:testnet'
} as const;

export type SupportedChain = keyof typeof SUPPORTED_SOLANA_CHAINS;
