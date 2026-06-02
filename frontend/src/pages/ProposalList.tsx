/**
 * ProposalList page
 *
 * Owns the data-fetching lifecycle for the proposal list.
 * While loading, it renders accessible skeleton cards instead of a blank
 * screen. Once data arrives (or an error occurs) the real content replaces
 * the skeletons and aria-busy is resolved.
 */

import { useProposals } from '../hooks/useProposals';
import ProposalListComponent from '../components/ProposalList';
import { ProposalSkeletonList } from '../components/ProposalCardSkeleton';

// How many skeleton cards to display while loading.
// Should roughly match the typical number of proposals visible above the fold.
const SKELETON_COUNT = 5;

export default function ProposalListPage() {
  const { proposals, loading, error, refresh } = useProposals();

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="container">
        {/* Page heading placeholder keeps vertical rhythm stable */}
        <div className="page-heading">
          <h1>Proposals</h1>
          <p className="page-subtitle" aria-live="polite" aria-atomic="true">
            Fetching proposals from the Stellar network…
          </p>
        </div>
        <ProposalSkeletonList count={SKELETON_COUNT} />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="container">
        <div className="page-heading">
          <h1>Proposals</h1>
        </div>
        {/*
         * role="alert" ensures screen readers announce the error immediately
         * without the user having to navigate to it (WCAG 4.1.3).
         */}
        <div role="alert" aria-live="assertive" className="card" style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--color-text)' }}>
            Could not load proposals: <strong>{error}</strong>
          </p>
          <button type="button" onClick={refresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Loaded state ───────────────────────────────────────────
  return (
    /*
     * aria-busy="false" is the default, but we set it explicitly here so that
     * screen readers surfacing the attribute after a transition see the correct
     * value when the skeleton list (aria-busy="true") is replaced.
     */
    <div className="container" aria-busy="false">
      <ProposalListComponent proposals={proposals} />
    </div>
  );
}
