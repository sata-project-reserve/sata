import { describe, expect, it } from 'vitest';
import bs58 from 'bs58';
import type { Transaction } from '@solana/web3.js';
import { executeWalletTransaction, type StandardWalletHandle } from '@/lib/wallet/execute';

describe('executeWalletTransaction', () => {
  it('accepts wallet-standard array outputs from MetaMask signAndSendTransaction', async () => {
    const owner = 'HtDVYgAwwWzWWTSer1MtNVvJpZHhKjLo2Drzu2eARRaT';
    const transaction = {
      serialize: () => Buffer.from([1, 2, 3, 4])
    } as unknown as Transaction;
    let receivedTransaction: Uint8Array | undefined;
    const signature = new Uint8Array(64).fill(7);
    const handle: StandardWalletHandle = {
      wallet: {
        features: {
          'solana:signAndSendTransaction': {
            signAndSendTransaction: (input: {
              account: StandardWalletHandle['account'];
              chain: string;
              transaction: Uint8Array;
            }) => {
              receivedTransaction = input.transaction;
              return Promise.resolve([
                {
                  signature
                }
              ]);
            }
          }
        }
      },
      account: {
        address: owner,
        publicKey: bs58.decode(owner)
      },
      chain: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
    };

    await expect(executeWalletTransaction(handle, transaction)).resolves.toBe(bs58.encode(signature));
    expect(receivedTransaction).toBeInstanceOf(Uint8Array);
    expect(receivedTransaction?.constructor).toBe(Uint8Array);
  });
});
