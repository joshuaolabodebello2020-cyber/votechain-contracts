import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { SessionTimeoutWarning } from '../components/SessionTimeoutWarning';

// ── i18n mock ────────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// ── useSessionTimeout ────────────────────────────────────────────────────────
describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show warning initially', () => {
    const { result } = renderHook(() =>
      useSessionTimeout({ timeoutMs: 10_000, warningMs: 2_000 })
    );
    expect(result.current.showWarning).toBe(false);
  });

  it('shows warning when warningMs before expiry elapses', () => {
    const { result } = renderHook(() =>
      useSessionTimeout({ timeoutMs: 10_000, warningMs: 2_000 })
    );
    act(() => { vi.advanceTimersByTime(8_001); });
    expect(result.current.showWarning).toBe(true);
  });

  it('calls onExpired after timeoutMs', () => {
    const onExpired = vi.fn();
    renderHook(() =>
      useSessionTimeout({ timeoutMs: 10_000, warningMs: 2_000, onExpired })
    );
    act(() => { vi.advanceTimersByTime(10_001); });
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it('resetSession clears the warning and restarts timers', () => {
    const { result } = renderHook(() =>
      useSessionTimeout({ timeoutMs: 10_000, warningMs: 2_000 })
    );
    act(() => { vi.advanceTimersByTime(8_001); });
    expect(result.current.showWarning).toBe(true);

    act(() => { result.current.resetSession(); });
    expect(result.current.showWarning).toBe(false);
  });

  it('resets timer on user activity (mousemove)', () => {
    const onExpired = vi.fn();
    renderHook(() =>
      useSessionTimeout({ timeoutMs: 10_000, warningMs: 2_000, onExpired })
    );
    // Advance to 9s (not yet expired), then fire activity
    act(() => { vi.advanceTimersByTime(9_000); });
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });
    // Advance another 9s — timer restarted so should NOT have expired
    act(() => { vi.advanceTimersByTime(9_000); });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('calls onRefresh when window gains focus', () => {
    const onRefresh = vi.fn();
    renderHook(() => useSessionTimeout({ onRefresh }));
    act(() => { window.dispatchEvent(new FocusEvent('focus')); });
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('does not call onRefresh if not provided', () => {
    // Should not throw
    expect(() => {
      const { result } = renderHook(() => useSessionTimeout({}));
      act(() => { window.dispatchEvent(new FocusEvent('focus')); });
    }).not.toThrow();
  });
});

// ── SessionTimeoutWarning ────────────────────────────────────────────────────
describe('SessionTimeoutWarning', () => {
  it('renders the warning message', () => {
    render(<SessionTimeoutWarning onDismiss={vi.fn()} />);
    expect(screen.getByText('session.warningMessage')).toBeInTheDocument();
  });

  it('has role="alert" for screen-reader announcement', () => {
    render(<SessionTimeoutWarning onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onDismiss when the button is clicked', async () => {
    const onDismiss = vi.fn();
    render(<SessionTimeoutWarning onDismiss={onDismiss} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'session.stayLoggedInAriaLabel' })
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('button has an accessible aria-label', () => {
    render(<SessionTimeoutWarning onDismiss={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'session.stayLoggedInAriaLabel' });
    expect(btn).toBeInTheDocument();
  });
});
