/**
 * useProposals
 *
 * Fetches the proposal list from the backend / Soroban RPC and manages
 * loading / error state. Uses the central proposal store for consistency.
 * Preserves existing data on network errors for offline experience.
 */

import { useEffect, useCallback } from 'react';
import { sampleProposals } from '../data';
import type { Proposal } from '../types';
import { useProposalStore } from '../store';
import { api } from '../api/ApiClient';

const ENABLE_FOCUS_REFRESH = import.meta.env.VITE_ENABLE_FOCUS_REFRESH !== 'false';
const FOCUS_REFRESH_DEBOUNCE_MS = parseNumberEnv('FOCUS_REFRESH_DEBOUNCE_MS', 3000);

function parseNumberEnv(key: string, fallback: number): number {
  const raw = import.meta.env[`VITE_${key}`] as string | undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// â”€â”€ Mock fetcher (replace with real implementation) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchProposals(): Promise<Proposal[]> {
  return api.get<Proposal[]>('/api/proposals');
}

// â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface UseProposalsResult {
  proposals: Proposal[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
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
    lastFetch,
  } = useProposalStore();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProposals();
      const blockNumber = Date.now();
      setProposals(data, blockNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals.');
    } finally {
      setLoading(false);
    }
  }, [setProposals, setLoading, setError]);

  useEffect(() => {
    if (lastBlock === 0) {
      refresh();
    }
  }, [lastBlock, refresh]);

  useEffect(() => {
    if (!ENABLE_FOCUS_REFRESH || typeof window === 'undefined') return undefined;

    let lastRefreshAt = 0;

    const handleRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshAt < FOCUS_REFRESH_DEBOUNCE_MS) {
        return;
      }

      lastRefreshAt = now;
      refresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh]);

  return {
    proposals: getAllProposals(),
    loading,
    error,
    lastFetch,
    refresh,
  };
}
