import type { SupportedChain } from './constants';

export function explorerAddressLink(address: string, cluster: SupportedChain): string {
  return explorerLink('address', address, cluster);
}

export function explorerTxLink(signature: string, cluster: SupportedChain): string {
  return explorerLink('tx', signature, cluster);
}

function explorerLink(kind: 'address' | 'tx', value: string, cluster: SupportedChain): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/${kind}/${value}${clusterParam}`;
}
