import React from 'react';
import Skeleton from '../components/Skeleton';

const VoteHistorySkeleton: React.FC = () => {
  return (
    <section aria-labelledby="vote-history-heading" className="card">
      {/* ── Header ── */}
      <div className="header">
        <div>
          <h2 id="vote-history-heading"><Skeleton width="200px" height="28px" /></h2>
          <p><Skeleton width="300px" height="18px" /></p>
        </div>
        <Skeleton width="120px" height="40px" borderRadius="8px" />
      </div>

      {/* ── Filters ── */}
      <form className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {/* Address input */}
        <div>
          <Skeleton width="100px" height="18px" style={{ marginBottom: '0.3rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Skeleton width="100%" height="38px" />
            <Skeleton width="150px" height="38px" borderRadius="8px" />
          </div>
        </div>

        {/* Date range */}
        <div>
          <Skeleton width="80px" height="18px" style={{ marginBottom: '0.3rem' }} />
          <Skeleton width="100%" height="38px" />
        </div>
        <div>
          <Skeleton width="80px" height="18px" style={{ marginBottom: '0.3rem' }} />
          <Skeleton width="100%" height="38px" />
        </div>

        {/* State filter */}
        <div>
          <Skeleton width="80px" height="18px" style={{ marginBottom: '0.3rem' }} />
          <Skeleton width="100%" height="38px" />
        </div>
      </form>

      {/* ── Table ── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th><Skeleton width="80px" height="20px" /></th>
              <th><Skeleton width="60px" height="20px" /></th>
              <th><Skeleton width="70px" height="20px" /></th>
              <th><Skeleton width="70px" height="20px" /></th>
              <th><Skeleton width="90px" height="20px" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td><Skeleton width="100%" height="20px" /></td>
                <td><Skeleton width="100%" height="20px" /></td>
                <td><Skeleton width="100%" height="20px" /></td>
                <td><Skeleton width="100%" height="20px" /></td>
                <td><Skeleton width="100%" height="20px" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default VoteHistorySkeleton;
