import { create } from 'zustand';
import type { Proposal, VoteRecord, ProposalState } from '../types';
import { validateRpcUrl, checkRpcHealth, type RpcValidationResult } from '../utils/stellarRpc';

export type Network = 'testnet' | 'mainnet';

export interface NetworkConfig {
  network: Network;
  rpcUrl: string;
  passphrase: string;
}

export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
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
  rpcValidation: RpcValidationResult | null;
  rpcHealthy: boolean;
  rpcLoading: boolean;
  setNetwork: (network: Network) => void;
  setCustomRpc: (config: NetworkConfig) => void;
  validateAndCheckRpc: (config: NetworkConfig) => Promise<void>;
}

// Optimistic vote data for a proposal
export interface OptimisticVote {
  choice: VoteRecord['type'];
  weight: number;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

// Proposal with optional optimistic patch
export type ProposalWithPatch = Proposal & {
  optimisticVote?: OptimisticVote;
};

interface ProposalStoreState {
  // Core proposal data
  proposals: Record<string, Proposal>;
  // Loading/error state for fetching
  loading: boolean;
  error: string | null;
  // Last fetch timestamp for stale data indication
  lastFetch: number | null;
  // Last block we fetched data at (for deduplication)
  lastBlock: number;
  // Optimistic vote patches per proposal
  optimisticVotes: Record<string, OptimisticVote>;
  // Actions
  setProposals: (proposals: Proposal[], block: number, timestamp?: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  invalidate: () => void;
  // Optimistic voting
  applyOptimisticVote: (proposalId: string, choice: VoteRecord['type'], weight: number) => void;
  confirmOptimisticVote: (proposalId: string) => void;
  revertOptimisticVote: (proposalId: string) => void;
  // Helper to get proposal with patch applied
  getProposal: (id: string) => ProposalWithPatch | undefined;
  getAllProposals: () => ProposalWithPatch[];
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  connected: false,
  connect: (address: string) => set({ address, connected: true }),
  disconnect: () => set({ address: null, connected: false }),
}));

export const useNetworkStore = create<NetworkState>((set, get) => ({
  config: NETWORK_CONFIGS.testnet,
  rpcValidation: null,
  rpcHealthy: false,
  rpcLoading: false,

  setNetwork: async (network: Network) => {
    const config = NETWORK_CONFIGS[network];
    set({ config });
    await get().validateAndCheckRpc(config);
  },

  setCustomRpc: async (config: NetworkConfig) => {
    set({ config });
    await get().validateAndCheckRpc(config);
  },

  validateAndCheckRpc: async (config: NetworkConfig) => {
    set({ rpcLoading: true });
    try {
      const validation = validateRpcUrl(config.rpcUrl);
      set({ rpcValidation: validation });
      
      if (validation.isValid) {
        const healthy = await checkRpcHealth(config.rpcUrl);
        set({ rpcHealthy: healthy });
      } else {
        set({ rpcHealthy: false });
      }
    } catch (error) {
      set({
        rpcValidation: {
          isValid: false,
          isSecure: false,
          error: error instanceof Error ? error.message : 'Unknown error validating RPC',
        },
        rpcHealthy: false,
      });
    } finally {
      set({ rpcLoading: false });
    }
  },
}));

// Helper to apply optimistic vote to a proposal
function applyPatch(proposal: Proposal, patch?: OptimisticVote): ProposalWithPatch {
  if (!patch) return proposal;

  const { choice, weight, status } = patch;
  // Apply patch to vote counts
  const patched: ProposalWithPatch = {
    ...proposal,
    optimisticVote: patch,
    votesCount: proposal.votesCount + (status === 'failed' ? 0 : 1),
    totalWeight: proposal.totalWeight + (status === 'failed' ? 0 : weight),
  };
  return patched;
}

export const useProposalStore = create<ProposalStoreState>((set, get) => ({
  proposals: {},
  loading: true,
  error: null,
  lastFetch: null,
  lastBlock: 0,
  optimisticVotes: {},

  setProposals: (proposals: Proposal[], block: number, timestamp?: number) =>
    set((state: ProposalStoreState) => {
      // Remove optimistic votes that are already confirmed, since fresh data will reflect them
      const filteredOptimisticVotes: Record<string, OptimisticVote> = {};
      Object.entries(state.optimisticVotes).forEach(([id, vote]) => {
        if (vote.status !== 'confirmed') {
          filteredOptimisticVotes[id] = vote;
        }
      });

      return {
        proposals: Object.fromEntries(proposals.map((p: Proposal) => [p.id, p])),
        lastBlock: block,
        lastFetch: timestamp ?? Date.now(),
        error: null,
        optimisticVotes: filteredOptimisticVotes,
      };
    }),

  setLoading: (loading: boolean) => set({ loading }),

  setError: (error: string | null) => set({ error }),

  invalidate: () => set({ proposals: {}, lastBlock: 0, lastFetch: null, error: null }),

  applyOptimisticVote: (proposalId: string, choice: VoteRecord['type'], weight: number) =>
    set((state: ProposalStoreState) => ({
      optimisticVotes: {
        ...state.optimisticVotes,
        [proposalId]: {
          choice,
          weight,
          status: 'pending',
        },
      },
    })),

  confirmOptimisticVote: (proposalId: string) =>
    set((state: ProposalStoreState) => ({
      optimisticVotes: {
        ...state.optimisticVotes,
        [proposalId]: {
          ...state.optimisticVotes[proposalId],
          status: 'confirmed',
        },
      },
    })),

  revertOptimisticVote: (proposalId: string) =>
    set((state: ProposalStoreState) => {
      const newVotes = { ...state.optimisticVotes };
      delete newVotes[proposalId];
      return { optimisticVotes: newVotes };
    }),

  getProposal: (id: string) => {
    const state: ProposalStoreState = get();
    const proposal: Proposal | undefined = state.proposals[id];
    if (!proposal) return undefined;
    return applyPatch(proposal, state.optimisticVotes[id]);
  },

  getAllProposals: () => {
    const state: ProposalStoreState = get();
    return Object.values(state.proposals).map((p: Proposal) =>
      applyPatch(p, state.optimisticVotes[p.id])
    );
  },
}));
