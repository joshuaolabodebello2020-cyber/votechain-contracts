import { useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Accessible modal dialog.
 * - Traps focus inside while open (WCAG 2.1 SC 2.1.2)
 * - Escape key closes the modal
 * - Returns focus to the trigger element on close
 * - Uses role="dialog" with aria-modal and aria-labelledby
 */
export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  // Restore focus to the previously focused element when modal closes
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal"
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="modal-close"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
