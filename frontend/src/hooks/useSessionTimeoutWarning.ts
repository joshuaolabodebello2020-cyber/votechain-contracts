import { useState, useEffect, useCallback } from 'react';

const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_SESSION_WARNING_MS = 60 * 1000; // 1 minute
const DEFAULT_MIN_REFRESH_INTERVAL_MS = 5 * 1000; // 5 seconds

function parseNumberEnv(key: string, fallback: number): number {
  const raw = import.meta.env[`VITE_${key}`] as string | undefined;
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const sessionTimeoutConfig = {
  enabled: import.meta.env.VITE_ENABLE_SESSION_WARNING !== 'false',
  timeoutMs: parseNumberEnv('SESSION_TIMEOUT_MS', DEFAULT_SESSION_TIMEOUT_MS),
  warningMs: parseNumberEnv('SESSION_WARNING_MS', DEFAULT_SESSION_WARNING_MS),
  minRefreshIntervalMs: parseNumberEnv('SESSION_FOCUS_REFRESH_DEBOUNCE_MS', DEFAULT_MIN_REFRESH_INTERVAL_MS),
};

interface UseSessionTimeoutWarningResult {
  warningVisible: boolean;
  secondsUntilExpiry: number;
  keepAlive: () => void;
}

export function useSessionTimeoutWarning(): UseSessionTimeoutWarningResult {
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsUntilExpiry, setSecondsUntilExpiry] = useState(() => Math.ceil(sessionTimeoutConfig.timeoutMs / 1000));

  const keepAlive = useCallback(() => {
    setLastActivity(Date.now());
    setWarningVisible(false);
  }, []);

  const recordActivity = useCallback(() => {
    keepAlive();
  }, [keepAlive]);

  useEffect(() => {
    if (!sessionTimeoutConfig.enabled || typeof window === 'undefined') return undefined;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((eventName) => window.addEventListener(eventName, recordActivity));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
    };
  }, [recordActivity]);

  useEffect(() => {
    if (!sessionTimeoutConfig.enabled || typeof window === 'undefined') return undefined;

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const remainingMs = sessionTimeoutConfig.timeoutMs - elapsed;
      setSecondsUntilExpiry(Math.max(0, Math.ceil(remainingMs / 1000)));
      setWarningVisible(remainingMs <= sessionTimeoutConfig.warningMs && remainingMs > 0);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [lastActivity]);

  return {
    warningVisible: sessionTimeoutConfig.enabled && warningVisible,
    secondsUntilExpiry,
    keepAlive,
  };
}
