/**
 * useSessionTimeout
 *
 * Tracks user activity and provides:
 * - `showWarning`  — true when the session is about to expire
 * - `resetSession` — call this to dismiss the warning and reset the idle timer
 *
 * Also fires `onRefresh` whenever the window regains focus, so proposal data
 * stays fresh after the user has been idle in another tab.
 *
 * Configuration (all optional, values are in milliseconds):
 *   timeoutMs      — idle time before the session is considered expired (default 30 min)
 *   warningMs      — how long before expiry to show the warning (default 2 min)
 *   onExpired      — called when the session expires (e.g. clear wallet state)
 *   onRefresh      — called on window focus (e.g. re-fetch proposals)
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface SessionTimeoutOptions {
  timeoutMs?: number;
  warningMs?: number;
  onExpired?: () => void;
  onRefresh?: () => void;
}

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'] as const;

export function useSessionTimeout({
  timeoutMs = 30 * 60 * 1000,
  warningMs = 2 * 60 * 1000,
  onExpired,
  onRefresh,
}: SessionTimeoutOptions = {}) {
  const [showWarning, setShowWarning] = useState(false);

  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (expireTimer.current) clearTimeout(expireTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
  }, []);

  const resetSession = useCallback(() => {
    setShowWarning(false);
    clearTimers();

    warnTimer.current = setTimeout(() => {
      setShowWarning(true);
    }, timeoutMs - warningMs);

    expireTimer.current = setTimeout(() => {
      setShowWarning(false);
      onExpired?.();
    }, timeoutMs);
  }, [timeoutMs, warningMs, onExpired, clearTimers]);

  // Restart the countdown on any user activity
  useEffect(() => {
    const handler = () => resetSession();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler));
  }, [resetSession]);

  // Refresh on focus
  useEffect(() => {
    if (!onRefresh) return;
    const handler = () => onRefresh();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [onRefresh]);

  // Start the timer on mount
  useEffect(() => {
    resetSession();
    return clearTimers;
  }, [resetSession, clearTimers]);

  return { showWarning, resetSession };
}
