/**
 * useProposals
 *
 * Fetches the proposal list from the backend / Soroban RPC and manages
 * loading / error state. Uses the central proposal store for consistency.
 */

import { useEffect, useCallback } from 'react';
import { sampleProposals } from '../data';
import type { Proposal } from '../types';
import { useProposalStore } from '../store';

// ── Mock fetcher (replace with real implementation) ──────────────────────────

async function fetchProposals(): Promise<Proposal[]> {
  // Simulate network latency so the skeleton loader is visible during dev.
  // Remove the setTimeout in production and replace with the real call, e.g.:
  //
  //   const res = await fetch('/api/proposals');
  //   if (!res.ok) throw new Error(`HTTP ${res.status}`);
  //   return res.json() as Promise<Proposal[]>;
  //
  await new Promise<void>((resolve) => setTimeout(resolve, 1500));
  return sampleProposals;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseProposalsResult {
  proposals: Proposal[];
  loading: boolean;
  error: string | null;
  /** Manually trigger a re-fetch (e.g. after submitting a new proposal). */
  refresh: () => Promise<void>;
}

export function useProposals(): UseProposalsResult {
  const {
    getAllProposals,
    setProposals,
    setLoading,
    setError,
    loading,
    error,
    lastBlock,
  } = useProposalStore();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProposals();
      // We'll use current timestamp as mock block number
      const blockNumber = Date.now();
      setProposals(data, blockNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals.');
    } finally {
      setLoading(false);
    }
  }, [setProposals, setLoading, setError]);

  // Initial fetch when hook mounts (or lastBlock changes)
  useEffect(() => {
    if (lastBlock === 0) {
      refresh();
    }
  }, [lastBlock, refresh]);

  return {
    proposals: getAllProposals(),
    loading,
    error,
    refresh,
  };
}
