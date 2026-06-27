import React from 'react';
import Skeleton from '../../components/Skeleton';
import './ProposalDetail.css'; // Import the original CSS for consistent layout

const ProposalDetailSkeleton: React.FC = () => {
  return (
    <div className="proposal-detail">
      <div className="proposal-header">
        <Skeleton width="120px" height="20px" className="back-link" />
        <Skeleton width="80px" height="28px" borderRadius="9999px" className="proposal-status-badge" />
      </div>

      <h1 className="proposal-title">
        <Skeleton width="70%" height="32px" />
      </h1>
      
      <div className="proposal-meta">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="meta-item" key={i}>
            <Skeleton width="60px" height="12px" className="meta-label" />
            <Skeleton width="100px" height="18px" className="meta-value" />
          </div>
        ))}
      </div>

      <div className="proposal-section">
        <h3><Skeleton width="100px" height="24px" /></h3>
        <p className="proposal-description">
          <Skeleton width="100%" height="18px" style={{ marginBottom: '8px' }} />
          <Skeleton width="95%" height="18px" style={{ marginBottom: '8px' }} />
          <Skeleton width="90%" height="18px" />
        </p>
      </div>

      <div className="proposal-section">
        <h3><Skeleton width="120px" height="24px" /></h3>
        <div className="vote-stats">
          <div className="chart-container">
            <div className="stat-bar-container">
              <div className="stat-bar">
                <Skeleton width="33%" height="100%" />
                <Skeleton width="33%" height="100%" />
                <Skeleton width="34%" height="100%" />
              </div>
            </div>
            <div className="stat-labels">
              {Array.from({ length: 3 }).map((_, i) => (
                <div className="label-item" key={i}>
                  <Skeleton width="12px" height="12px" borderRadius="50%" className="dot" />
                  <Skeleton width="80px" height="14px" className="label-text" />
                </div>
              ))}
            </div>
          </div>

          <div className="quorum-container">
            <div className="quorum-header">
              <Skeleton width="100px" height="14px" className="quorum-label" />
              <Skeleton width="80px" height="14px" className="quorum-value" />
            </div>
            <div className="progress-bar-container">
              <Skeleton width="70%" height="100%" className="progress-bar" />
            </div>
            <Skeleton width="150px" height="12px" className="quorum-status" />
          </div>
        </div>
      </div>

      <div className="proposal-actions">
        <div className="vote-buttons">
          <Skeleton width="100px" height="40px" borderRadius="8px" className="btn" />
          <Skeleton width="100px" height="40px" borderRadius="8px" className="btn" />
          <Skeleton width="100px" height="40px" borderRadius="8px" className="btn" />
        </div>
      </div>
    </div>
  );
};

export default ProposalDetailSkeleton;
