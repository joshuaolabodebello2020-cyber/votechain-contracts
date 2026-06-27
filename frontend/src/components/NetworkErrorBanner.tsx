interface StaleDataIndicatorProps {
  isOffline: boolean;
  lastFetchTime: Date | null;
}

export function StaleDataIndicator({ isOffline, lastFetchTime }: StaleDataIndicatorProps) {
  if (!isOffline || !lastFetchTime) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: '#783c00',
        color: '#fed7aa',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.25rem',
        marginBottom: '0.5rem',
        fontSize: '0.8rem',
      }}
    >
      <span aria-hidden="true">⚠</span> Showing data from {lastFetchTime.toLocaleTimeString()}. Connection lost.
    </div>
  );
}