import bs58 from 'bs58';
import type { Transaction } from '@solana/web3.js';

export type StandardWalletHandle = {
  wallet: unknown;
  account: {
    address: string;
    publicKey?: Uint8Array;
  };
  chain: string;
};

type SignAndSendFeature = {
  signAndSendTransaction: (
    ...inputs: {
      account: StandardWalletHandle['account'];
      chain: string;
      transaction: Uint8Array;
    }[]
  ) => Promise<{ signature: Uint8Array }[] | { signature: Uint8Array }>;
};

type SignTransactionFeature = {
  signTransaction: (
    ...inputs: {
      account: StandardWalletHandle['account'];
      chain: string;
      transaction: Uint8Array;
    }[]
  ) => Promise<{ signedTransaction: Uint8Array }[] | { signedTransaction: Uint8Array }>;
};

type WalletWithFeatures = {
  features: Record<string, unknown>;
};

export async function executeWalletTransaction(
  handle: StandardWalletHandle,
  transaction: Transaction
): Promise<string> {
  const wallet = handle.wallet as WalletWithFeatures;
  const serialized = toPlainUint8Array(
    transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    })
  );

  const signAndSend = wallet.features['solana:signAndSendTransaction'] as
    | SignAndSendFeature
    | undefined;
  if (signAndSend) {
    const result = await signAndSend.signAndSendTransaction({
      account: handle.account,
      chain: handle.chain,
      transaction: serialized
    });
    const firstResult = Array.isArray(result) ? result[0] : result;
    if (!firstResult?.signature) {
      throw new Error('MetaMask did not return a Solana transaction signature.');
    }
    return bs58.encode(firstResult.signature);
  }

  const signTransaction = wallet.features['solana:signTransaction'] as
    | SignTransactionFeature
    | undefined;
  if (!signTransaction) {
    throw new Error('MetaMask does not expose a Solana transaction signing feature.');
  }

  throw new Error(
    'This wallet only exposes signTransaction; direct send fallback is disabled until RPC submission is explicitly reviewed.'
  );
}

function toPlainUint8Array(value: Uint8Array): Uint8Array {
  return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
}
