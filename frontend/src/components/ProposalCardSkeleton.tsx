/**
 * ProposalCardSkeleton
 *
 * A shimmer placeholder that mirrors the visual layout of a real proposal card.
 * Dimensions, spacing, and border tokens match the `.proposal-card` rules in
 * styles.css so the layout shift when real data arrives is imperceptible.
 *
 * Accessibility:
 *  - The wrapping <li> carries no semantic meaning by itself; aria is managed
 *    by the parent <ProposalSkeletonList> which sets aria-busy / aria-label.
 *  - Each block element uses role="presentation" so assistive technologies skip
 *    over the purely decorative placeholder shapes.
 */

import './ProposalCardSkeleton.css';

export default function ProposalCardSkeleton() {
  return (
    <li className="proposal-card skeleton-card" aria-hidden="true">
      {/* ── Card header: ID pill + badge ──────────────────────── */}
      <div className="card-header">
        <div className="card-title-row">
          {/* Mono ID line */}
          <div
            className="skeleton-block"
            style={{ width: '4.5rem', height: '0.75rem', marginBottom: '0.4rem' }}
            role="presentation"
          />
          {/* Title — two lines */}
          <div
            className="skeleton-block"
            style={{ width: '85%', height: '1rem', marginBottom: '0.35rem' }}
            role="presentation"
          />
          <div
            className="skeleton-block"
            style={{ width: '55%', height: '1rem' }}
            role="presentation"
          />
        </div>

        {/* State badge pill */}
        <div
          className="skeleton-block"
          style={{ width: '5rem', height: '1.4rem', borderRadius: '999px', flexShrink: 0 }}
          role="presentation"
        />
      </div>

      {/* ── Vote summary bar ──────────────────────────────────── */}
      <div className="vote-summary" style={{ marginBottom: '0.85rem' }}>
        {/* Progress bar track */}
        <div
          className="skeleton-block"
          style={{ height: '6px', borderRadius: '999px', marginBottom: '0.5rem' }}
          role="presentation"
        />
        {/* Vote count labels */}
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {[62, 48, 38].map((w) => (
            <div
              key={w}
              className="skeleton-block"
              style={{ width: `${w}px`, height: '0.75rem' }}
              role="presentation"
            />
          ))}
        </div>
      </div>

      {/* ── Card footer: proposer + countdown ─────────────────── */}
      <div
        className="card-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div
          className="skeleton-block"
          style={{ width: '8rem', height: '0.75rem' }}
          role="presentation"
        />
        <div
          className="skeleton-block"
          style={{ width: '5.5rem', height: '0.75rem' }}
          role="presentation"
        />
      </div>
    </li>
  );
}

// ── List wrapper ─────────────────────────────────────────────────────────────

interface ProposalSkeletonListProps {
  /** Number of skeleton cards to render. Defaults to 4. */
  count?: number;
}

/**
 * Renders a visually accessible list of skeleton cards.
 *
 * - aria-busy="true"  signals to AT that the region is still loading.
 * - aria-label        gives the live region a human-readable name.
 * - aria-live="polite" lets the AT announce when loading is done without
 *   interrupting the user mid-sentence.
 */
export function ProposalSkeletonList({ count = 4 }: ProposalSkeletonListProps) {
  return (
    <ul
      className="proposal-list"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading proposals…"
    >
      {/* Screen-reader-only text so AT users know what's happening */}
      <li className="sr-only">Loading proposals, please wait.</li>

      {Array.from({ length: count }, (_, i) => (
        <ProposalCardSkeleton key={i} />
      ))}
    </ul>
  );
}
