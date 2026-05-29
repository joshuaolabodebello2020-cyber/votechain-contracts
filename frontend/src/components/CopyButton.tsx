import React, { useState } from 'react';

interface CopyButtonProps {
  value: string;
  /** Milliseconds before icon resets. Default: 2000 */
  resetDelay?: number;
}

export function CopyButton({ value, resetDelay = 2000 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), resetDelay);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}
