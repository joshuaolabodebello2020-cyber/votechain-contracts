import { useCallback, useRef, useState } from 'react';
import type { Proposal, VoteRecord } from '../types';
import { useTransactionStatus } from './useTransactionStatus';

// ── Types ──────────────────────────────────────────────────────────────────

export type VoteChoice = VoteRecord['type']; // 'For' | 'Against' | 'Abstain'

/** The shape of vote counts we track per proposal. */
export interface VoteCounts {
  votesCount: number;
  totalWeight: number;
  forWeight: number;
  againstWeight: number;
  abstainWeight: number;
}

export type OptimisticStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface UseOptimisticVoteReturn {
  /** Current (possibly optimistic) vote counts for the active proposal. */
  counts: VoteCounts;
  /** Whether the optimistic update is in-flight (not yet confirmed). */
  status: OptimisticStatus;
  /** True while the transaction is being confirmed on-chain. */
  isConfirming: boolean;
  /**
   * Submit a vote optimistically.
   *
   * @param proposal  The proposal being voted on.
   * @param choice    The voter's choice.
   * @param weight    The voter's vote weight.
   * @param sendTx    Async function that broadcasts the transaction and returns
   *                  the transaction hash. Throw to signal failure.
   */
  castVote: (
    proposal: Proposal,
    choice: VoteChoice,
    weight: number,
    sendTx: () => Promise<string>
  ) => Promise<void>;
  /** Underlying tx state from useTransactionStatus (for the toast). */
  tx: ReturnType<typeof useTransactionStatus>['tx'];
  resetTx: ReturnType<typeof useTransactionStatus>['reset'];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function countsFromProposal(proposal: Proposal): VoteCounts {
  const forWeight = proposal.votes
    .filter((v) => v.type === 'For')
    .reduce((s, v) => s + v.weight, 0);
  const againstWeight = proposal.votes
    .filter((v) => v.type === 'Against')
    .reduce((s, v) => s + v.weight, 0);
  const abstainWeight = proposal.votes
    .filter((v) => v.type === 'Abstain')
    .reduce((s, v) => s + v.weight, 0);

  return {
    votesCount: proposal.votesCount,
    totalWeight: proposal.totalWeight,
    forWeight,
    againstWeight,
    abstainWeight,
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Manages optimistic vote counts for a single proposal.
 *
 * Flow:
 *   1. castVote() snapshots current counts and applies the delta immediately.
 *   2. sendTx() is called — if it throws, we roll back before the tx even starts.
 *   3. useTransactionStatus polls Horizon until confirmed or failed.
 *   4. On confirmed: status → 'confirmed' (caller should refresh server data).
 *   5. On failed:    counts roll back to the pre-vote snapshot.
 */
export function useOptimisticVote(proposal: Proposal): UseOptimisticVoteReturn {
  const { tx, submit: submitTx, reset: resetTx } = useTransactionStatus();

  const [counts, setCounts] = useState<VoteCounts>(() => countsFromProposal(proposal));
  const [status, setStatus] = useState<OptimisticStatus>('idle');

  // Keep a snapshot so we can roll back on failure.
  const snapshot = useRef<VoteCounts | null>(null);

  // Sync counts when the proposal prop changes (e.g. after server refresh).
  // We only sync when not in-flight to avoid clobbering the optimistic state.
  const prevProposalId = useRef(proposal.id);
  if (proposal.id !== prevProposalId.current) {
    prevProposalId.current = proposal.id;
    setCounts(countsFromProposal(proposal));
    setStatus('idle');
    snapshot.current = null;
  }

  const castVote = useCallback(
    async (
      targetProposal: Proposal,
      choice: VoteChoice,
      weight: number,
      sendTx: () => Promise<string>
    ) => {
      // ── 1. Snapshot current counts ──────────────────────────────────────
      const before = countsFromProposal(targetProposal);
      snapshot.current = before;

      // ── 2. Apply optimistic delta ────────────────────────────────────────
      const optimistic: VoteCounts = {
        votesCount: before.votesCount + 1,
        totalWeight: before.totalWeight + weight,
        forWeight: before.forWeight + (choice === 'For' ? weight : 0),
        againstWeight: before.againstWeight + (choice === 'Against' ? weight : 0),
        abstainWeight: before.abstainWeight + (choice === 'Abstain' ? weight : 0),
      };
      setCounts(optimistic);
      setStatus('pending');

      // ── 3. Broadcast the transaction ─────────────────────────────────────
      let hash: string;
      try {
        hash = await sendTx();
      } catch {
        // sendTx threw before we even got a hash — roll back immediately.
        setCounts(before);
        setStatus('failed');
        snapshot.current = null;
        return;
      }

      // ── 4. Start polling Horizon ─────────────────────────────────────────
      submitTx(hash);
    },
    [submitTx]
  );

  // ── 5. React to tx status changes ─────────────────────────────────────────
  // We watch tx.status and update our own status + roll back on failure.
  // Using a ref to avoid stale closure issues inside the effect.
  const prevTxStatus = useRef(tx.status);
  if (tx.status !== prevTxStatus.current) {
    prevTxStatus.current = tx.status;

    if (tx.status === 'confirmed') {
      setStatus('confirmed');
      snapshot.current = null;
    } else if (tx.status === 'failed') {
      // Roll back to the pre-vote snapshot.
      if (snapshot.current) {
        setCounts(snapshot.current);
        snapshot.current = null;
      }
      setStatus('failed');
    }
  }

  return {
    counts,
    status,
    isConfirming: tx.status === 'pending',
    castVote,
    tx,
    resetTx,
  };
}
