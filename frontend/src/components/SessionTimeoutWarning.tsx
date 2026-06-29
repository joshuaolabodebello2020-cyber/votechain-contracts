import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onDismiss: () => void;
}

/**
 * Accessible warning banner displayed when the session is about to expire.
 * Announces itself to screen readers via aria-live="assertive".
 */
export function SessionTimeoutWarning({ onDismiss }: Props) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: 9999,
        background: 'var(--color-warning-bg, #fff3cd)',
        color: 'var(--color-warning-text, #856404)',
        border: '1px solid var(--color-warning-border, #ffc107)',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        maxWidth: '22rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        boxShadow: '0 2px 8px rgba(0,0,0,.15)',
      }}
    >
      <p style={{ margin: 0, flex: 1, fontSize: '0.9rem' }}>
        {t('session.warningMessage')}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('session.stayLoggedInAriaLabel')}
        style={{
          background: 'none',
          border: '1px solid currentColor',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          color: 'inherit',
          padding: '0.2rem 0.5rem',
          fontSize: '0.85rem',
          flexShrink: 0,
        }}
      >
        {t('session.stayLoggedIn')}
      </button>
    </div>
  );
}
