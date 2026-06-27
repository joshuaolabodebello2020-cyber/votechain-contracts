import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

export interface NetworkState {
  isOnline: boolean;
  showRetry: boolean;
}

export function useNetworkConnection(): NetworkState {
  const { isOnline } = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRetry(true);
    }
  }, [isOnline]);

  const retry = () => {
    setShowRetry(false);
    setWasOffline(false);
    window.location.reload();
  };

  return { isOnline, showRetry };
}

export function useStaleDataIndicator() {
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    lastFetchTime,
    setLastFetchTime,
    isOnline,
    isStale: lastFetchTime !== null && !isOnline,
  };
}