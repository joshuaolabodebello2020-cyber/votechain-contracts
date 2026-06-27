import React from 'react';
import Skeleton from '../components/Skeleton';

const ProposalVoteCardSkeleton: React.FC = () => {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <strong><Skeleton width="70%" height="20px" /></strong>
        <p style={{ margin: '0.25rem 0 0' }}>
          <Skeleton width="90%" height="16px" />
          <Skeleton width="80%" height="16px" />
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
        <span>
          <Skeleton width="100px" height="14px" />
        </span>
        <span>
          <Skeleton width="100px" height="14px" />
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <Skeleton width="80px" height="36px" borderRadius="8px" />
        <Skeleton width="80px" height="36px" borderRadius="8px" />
        <Skeleton width="80px" height="36px" borderRadius="8px" />
      </div>

      <Skeleton width="120px" height="40px" borderRadius="8px" />
    </div>
  );
};

const VotingPanelSkeleton: React.FC = () => {
  return (
    <section aria-labelledby="voting-panel-heading" style={{ padding: '1.5rem' }}>
      <h2 id="voting-panel-heading"><Skeleton width="200px" height="28px" /></h2>
      <p><Skeleton width="300px" height="18px" /></p>

      {/* Simulate multiple proposal cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <ProposalVoteCardSkeleton key={i} />
      ))}
    </section>
  );
};

export default VotingPanelSkeleton;
