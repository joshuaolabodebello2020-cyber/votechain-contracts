type Network = 'testnet' | 'mainnet';

const BASE_URL: Record<Network, string> = {
  testnet: 'https://stellar.expert/explorer/testnet',
  mainnet: 'https://stellar.expert/explorer/public',
};

export function getTxUrl(hash: string, network: Network = 'testnet'): string {
  return `${BASE_URL[network]}/tx/${hash}`;
}

export function getAddressUrl(address: string, network: Network = 'testnet'): string {
  return `${BASE_URL[network]}/account/${address}`;
}

/** Props helper — use with <a> tags */
export function explorerLinkProps(url: string) {
  return { href: url, target: '_blank', rel: 'noopener noreferrer' };
}
