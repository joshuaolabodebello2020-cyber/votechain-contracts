import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Navbar.css';

type Network = 'mainnet' | 'testnet' | 'local';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [network, setNetwork] = useState<Network>('testnet');
  const [walletNetwork, setWalletNetwork] = useState<Network>('testnet');
  const [showWarning, setShowWarning] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    setShowWarning(network !== walletNetwork);
  }, [network, walletNetwork]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeMenu]);

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const firstFocusable = menu.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeMenu();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(menu.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-container">
        <div className="navbar-logo">
          <a href="/">VoteChain</a>
          <div className="network-indicator">
            <span className={`network-badge ${network}`}>
              {network.charAt(0).toUpperCase() + network.slice(1)}
            </span>
            {showWarning && (
              <span className="network-warning" role="alert" title="Wallet network mismatch!">
                ⚠️
              </span>
            )}
          </div>
        </div>

        <div className="navbar-links desktop-only">
          <a href="/proposals">Proposals</a>
          <a href="/create">Create</a>
          <a href="/about">About</a>
        </div>

        <button
          ref={hamburgerRef}
          className={`hamburger ${isOpen ? 'is-active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
          aria-controls="mobile-nav-menu"
        >
          <span className="hamburger-box">
            <span className="hamburger-inner"></span>
          </span>
        </button>

        <div
          id="mobile-nav-menu"
          ref={menuRef}
          className={`mobile-menu ${isOpen ? 'is-open' : ''}`}
          role="dialog"
          aria-modal={isOpen}
          aria-label="Mobile navigation"
        >
          <div className="mobile-menu-content">
            <div className="mobile-network-info">
              <span>Network:</span>
              <span className={`network-badge ${network}`}>
                {network.charAt(0).toUpperCase() + network.slice(1)}
              </span>
              {showWarning && (
                <div className="mismatch-alert" role="alert">
                  Wallet connected to {walletNetwork}
                </div>
              )}
            </div>
            <a href="/proposals" onClick={closeMenu}>Proposals</a>
            <a href="/create" onClick={closeMenu}>Create</a>
            <a href="/about" onClick={closeMenu}>About</a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
