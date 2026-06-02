import { create } from 'zustand';

export type Network = 'testnet' | 'mainnet';

interface NetworkConfig {
  network: Network;
  rpcUrl: string;
  passphrase: string;
}

const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  testnet: {
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
  },
  mainnet: {
    network: 'mainnet',
    rpcUrl: 'https://soroban-mainnet.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
  },
};

interface WalletState {
  address: string | null;
  connected: boolean;
  connect: (address: string) => void;
  disconnect: () => void;
}

interface NetworkState {
  config: NetworkConfig;
  setNetwork: (network: Network) => void;
}

export type Proposal = {
  id: string;
  [key: string]: unknown;
};

interface ProposalCacheState {
  proposals: Record<string, Proposal>;
  lastBlock: number;
  setProposals: (proposals: Proposal[], block: number) => void;
  invalidate: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  connected: false,
  connect: (address) => set({ address, connected: true }),
  disconnect: () => set({ address: null, connected: false }),
}));

export const useNetworkStore = create<NetworkState>((set) => ({
  config: NETWORK_CONFIGS.testnet,
  setNetwork: (network) => set({ config: NETWORK_CONFIGS[network] }),
}));

export const useProposalCache = create<ProposalCacheState>((set) => ({
  proposals: {},
  lastBlock: 0,
  setProposals: (proposals, block) =>
    set({
      proposals: Object.fromEntries(proposals.map((p) => [p.id, p])),
      lastBlock: block,
    }),
  invalidate: () => set({ proposals: {}, lastBlock: 0 }),
}));
