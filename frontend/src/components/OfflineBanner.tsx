import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface OfflineBannerProps {
  onRetry?: () => void;
}

export function OfflineBanner({ onRetry }: OfflineBannerProps) {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: '#7f1d1d',
        color: '#fecaca',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <div>
        <strong>Offline</strong>
        <p style={{ margin: 0, fontSize: '0.85rem', marginTop: '0.25rem' }}>
          No internet connection. Proposal data may be stale.
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: 'transparent',
            border: '1px solid #fecaca',
            color: '#fecaca',
            padding: '0.25rem 0.75rem',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Retry Connection
        </button>
      )}
    </div>
  );
}