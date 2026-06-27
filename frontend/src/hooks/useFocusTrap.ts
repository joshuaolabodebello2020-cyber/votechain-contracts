import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within the referenced container while `active` is true.
 *
 * - Captures the trigger element (document.activeElement) before moving focus in.
 * - Defers the initial focus shift to the next animation frame so the DOM is
 *   fully painted before querySelectorAll runs (avoids empty node-list on first render).
 * - Falls back to focusing the container itself when no focusable child exists,
 *   so focus always lands inside the dialog (requires tabIndex={-1} on the container).
 * - Restores focus to the trigger element when the trap is deactivated (WCAG 2.4.3).
 * - Tab / Shift+Tab cycle within the container (WCAG 2.1 SC 2.1.2).
 * - Escape calls `onClose`.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean, onClose?: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const container = ref.current;

    // Capture the trigger *before* we move focus away from it.
    const triggerElement = document.activeElement as HTMLElement | null;

    // Defer focus to the next frame so the modal's DOM is fully painted.
    const rafId = requestAnimationFrame(() => {
      const firstFocusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)[0];
      // Fall back to the container so focus always lands inside the dialog.
      (firstFocusable ?? container).focus();
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to the element that triggered the modal (WCAG 2.4.3).
      triggerElement?.focus();
    };
  }, [active, onClose]);

  return ref;
}
