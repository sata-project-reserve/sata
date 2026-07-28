import { PublicKey, type Connection } from '@solana/web3.js';
import { getAccount, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export type VerificationResult = {
  name: string;
  ok: boolean;
  detail: string;
};

export async function verifyMintSupply(params: {
  connection: Connection;
  mint: string;
  ata: string;
  expectedDecimals: number;
  expectedSupply: bigint;
  expectedOwner: string;
}): Promise<VerificationResult[]> {
  const mint = new PublicKey(params.mint);
  const ata = new PublicKey(params.ata);
  const owner = new PublicKey(params.expectedOwner);
  const mintInfo = await getMint(params.connection, mint, 'confirmed', TOKEN_PROGRAM_ID);
  const accountInfo = await getAccount(params.connection, ata, 'confirmed', TOKEN_PROGRAM_ID);

  return [
    {
      name: 'mint-owner-program',
      ok: mintInfo.address.equals(mint),
      detail: mintInfo.address.toBase58()
    },
    {
      name: 'decimals',
      ok: mintInfo.decimals === params.expectedDecimals,
      detail: String(mintInfo.decimals)
    },
    {
      name: 'total-supply',
      ok: mintInfo.supply === params.expectedSupply,
      detail: mintInfo.supply.toString()
    },
    {
      name: 'owner-token-balance',
      ok: accountInfo.owner.equals(owner) && accountInfo.amount === params.expectedSupply,
      detail: accountInfo.amount.toString()
    }
  ];
}
