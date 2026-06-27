import { useCallback } from 'react';
import type { Proposal, VoteRecord } from '../types';
import { useTransactionStatus } from './useTransactionStatus';
import { useProposalStore, type OptimisticVote } from '../store';
import { useProposals } from './useProposals';

// ── Types ──────────────────────────────────────────────────────────────────

export type VoteChoice = VoteRecord['type']; // 'For' | 'Against' | 'Abstain'

export type OptimisticStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface UseOptimisticVoteResult {
  /** Current (possibly optimistic) proposal data for given id */
  getProposal: (id: string) => Proposal | undefined;
  /** Get optimistic status for given proposal id */
  getStatus: (id: string) => OptimisticStatus;
  /** True while the transaction is being confirmed on-chain for given id */
  isConfirming: (id: string) => boolean;
  /**
   * Submit a vote optimistically using the shared store.
   */
  castVote: (
    proposalId: string,
    choice: VoteChoice,
    weight: number,
    sendTx: () => Promise<string>
  ) => Promise<void>;
  /** Underlying tx state from useTransactionStatus (for the toast) */
  tx: ReturnType<typeof useTransactionStatus>['tx'];
  resetTx: ReturnType<typeof useTransactionStatus>['reset'];
  /** Reset optimistic state for a specific proposal id */
  resetProposal: (id: string) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Manages optimistic vote counts using the shared proposal store.
 */
export function useOptimisticVote(): UseOptimisticVoteResult {
  const { tx, submit: submitTx, reset: resetTx } = useTransactionStatus();
  const {
    getProposal: getProposalFromStore,
    applyOptimisticVote,
    confirmOptimisticVote,
    revertOptimisticVote,
    optimisticVotes,
  } = useProposalStore();
  const { refresh } = useProposals();

  const getProposal = useCallback(
    (id: string) => {
      const proposal = getProposalFromStore(id);
      if (!proposal) return undefined;
      // Return as Proposal type (strip optimisticVote if needed for compatibility)
      const { optimisticVote, ...rest } = proposal;
      return rest;
    },
    [getProposalFromStore]
  );

  const getStatus = useCallback(
    (id: string): OptimisticStatus => {
      const vote = optimisticVotes[id];
      if (!vote) return 'idle';
      return vote.status;
    },
    [optimisticVotes]
  );

  const isConfirming = useCallback(
    (id: string): boolean => {
      const vote = optimisticVotes[id];
      return vote?.status === 'pending';
    },
    [optimisticVotes]
  );

  const castVote = useCallback(
    async (
      proposalId: string,
      choice: VoteChoice,
      weight: number,
      sendTx: () => Promise<string>
    ) => {
      // Apply optimistic update immediately
      applyOptimisticVote(proposalId, choice, weight);

      let hash: string;
      try {
        hash = await sendTx();
      } catch {
        // sendTx threw before we even got a hash — revert immediately
        revertOptimisticVote(proposalId);
        return;
      }

      // Start polling Horizon for confirmation
      try {
        await submitTx(hash);
        // If submitTx resolves, it's confirmed
        confirmOptimisticVote(proposalId);
        // Then refresh proposals to get fresh on-chain data
        await refresh();
      } catch {
        // If submitTx throws, it failed — revert
        revertOptimisticVote(proposalId);
      }
    },
    [applyOptimisticVote, revertOptimisticVote, confirmOptimisticVote, submitTx, refresh]
  );

  const resetProposal = useCallback(
    (id: string) => {
      revertOptimisticVote(id);
    },
    [revertOptimisticVote]
  );

  return {
    getProposal,
    getStatus,
    isConfirming,
    castVote,
    tx,
    resetTx,
    resetProposal,
  };
}
