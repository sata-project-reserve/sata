import { Connection, PublicKey } from '@solana/web3.js';
import { sanitizeRpcHost } from '@/lib/validation/config';

export type SolanaReadModel = {
  address: string;
  balanceLamports: bigint;
  rpcHost: string;
  cluster: string;
};

export function createConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, 'confirmed');
}

export async function inspectWallet(
  connection: Connection,
  address: string,
  cluster: string,
  rpcUrl: string
): Promise<SolanaReadModel> {
  const publicKey = new PublicKey(address);
  const balance = await connection.getBalance(publicKey, 'confirmed');
  return {
    address,
    balanceLamports: BigInt(balance),
    rpcHost: sanitizeRpcHost(rpcUrl),
    cluster
  };
}
