/**
 * useProposals
 *
 * Fetches the proposal list from the backend / Soroban RPC and manages
 * loading / error state. The hook is intentionally thin so it can be
 * swapped out for a real Soroban SDK call without touching any UI component.
 *
 * Replace `fetchProposals()` below with your actual data-fetching logic
 * (e.g. reading from the Soroban contract via stellar-sdk or hitting the
 * backend /api/proposals endpoint).
 */

import { useEffect, useState } from 'react';
import { sampleProposals } from '../data';
import type { Proposal } from '../types';

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
  refresh: () => void;
}

export function useProposals(): UseProposalsResult {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProposals();
        if (!cancelled) setProposals(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load proposals.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Cleanup: ignore stale responses if the component unmounts mid-fetch
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    proposals,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
