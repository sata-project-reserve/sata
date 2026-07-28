export type WalletStandardAccount = {
  address: string;
  chains?: readonly string[];
  features?: readonly string[];
};

export type WalletConnection = {
  address: string;
  chain: string;
  account: WalletStandardAccount;
  wallet: unknown;
};

type MetaMaskWallet = {
  features: {
    'standard:connect'?: {
      connect: () => Promise<{ accounts: unknown[] }>;
    };
  };
};

export async function connectMetaMaskSolana(
  expectedChain: string,
  rpcUrl: string
): Promise<WalletConnection> {
  const { createSolanaClient } = await import('@metamask/connect-solana');
  const client = await createSolanaClient({
    dapp: {
      name: 'SATA Token Launcher',
      url: window.location.origin
    },
    api: {
      supportedNetworks: {
        mainnet: rpcUrl,
        devnet: rpcUrl,
        testnet: rpcUrl
      }
    }
  });

  const wallet = client.getWallet() as MetaMaskWallet;
  const connectFeature = wallet.features['standard:connect'];
  if (!connectFeature) {
    throw new Error('MetaMask Solana Wallet Standard connect feature is unavailable.');
  }

  const { accounts } = await connectFeature.connect();
  const account = accounts[0] as WalletStandardAccount | undefined;
  if (!account?.address) {
    throw new Error('No Solana account was returned by MetaMask.');
  }

  const chains = account.chains ?? [];
  if (chains.length > 0 && !chains.includes(expectedChain)) {
    throw new Error(
      `Wallet account is not authorized for expected chain ${expectedChain}. Returned chains: ${chains.join(', ')}. Switch MetaMask Solana to the app cluster and reconnect.`
    );
  }

  return {
    address: account.address,
    chain: expectedChain,
    account,
    wallet
  };
}

export function assertSolanaNamespace(chains: readonly string[] | undefined): void {
  if (!chains || chains.length === 0) return;
  const unsupported = chains.filter((chain) => !chain.startsWith('solana:'));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported non-Solana account namespaces: ${unsupported.join(', ')}`);
  }
}
