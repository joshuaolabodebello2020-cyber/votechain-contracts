import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Accessible modal dialog.
 *
 * Focus management (WCAG 2.1 SC 2.1.2, 2.4.3):
 * - On open:  focus moves to the first focusable element inside the dialog
 *             (falls back to the dialog container itself via tabIndex={-1}).
 * - While open: Tab / Shift+Tab are trapped within the dialog.
 * - On close: focus returns to the element that triggered the modal.
 * - Escape key closes the modal.
 * - Clicking the backdrop closes the modal.
 *
 * Screen-reader support:
 * - role="dialog" + aria-modal="true" tells AT to ignore content outside.
 * - aria-labelledby links the dialog to its visible title.
 */
export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // useFocusTrap handles: focus-on-open, focus-trap, focus-restore, Escape key.
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal"
        // tabIndex={-1} makes the container itself focusable so useFocusTrap
        // always has a valid target when the dialog has no focusable children.
        tabIndex={-1}
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
