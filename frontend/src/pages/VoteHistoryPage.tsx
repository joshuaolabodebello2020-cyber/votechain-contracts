import React, { lazy, Suspense } from 'react';
import VoteHistoryPageSkeleton from './VoteHistoryPageSkeleton';

const LazyVoteHistoryPageContent = lazy(() => import('./VoteHistoryPageContent'));

export default function VoteHistoryPage() {
  return (
    <Suspense fallback={<VoteHistoryPageSkeleton />}>
      <LazyVoteHistoryPageContent />
    </Suspense>
  );
}

// ── Original content moved to VoteHistoryPageContent.tsx ───────────────────

import VoteHistory from '../components/VoteHistory';
import type { Proposal } from '../types';

// Placeholder — replace with real API/store data when the backend is wired up.
const PROPOSALS: Proposal[] = [];

export function VoteHistoryPageContent() {
  return <VoteHistory proposals={PROPOSALS} />;
}
