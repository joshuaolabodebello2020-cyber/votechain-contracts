import React, { useState, useEffect, useRef } from 'react';
import './Navbar.css';

type Network = 'mainnet' | 'testnet' | 'local';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [network, setNetwork] = useState<Network>('testnet'); // Default to testnet
  const [walletNetwork, setWalletNetwork] = useState<Network>('testnet');
  const [showWarning, setShowWarning] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  // Check for network mismatch
  useEffect(() => {
    if (network !== walletNetwork) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [network, walletNetwork]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    } else {
      window.removeEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <a href="/">VoteChain</a>
          <div className="network-indicator">
            <span className={`network-badge ${network}`}>
              {network.charAt(0).toUpperCase() + network.slice(1)}
            </span>
            {showWarning && (
              <span className="network-warning" title="Wallet network mismatch!">
                ⚠️
              </span>
            )}
          </div>
        </div>

        {/* Desktop Links */}
        <div className="navbar-links desktop-only">
          <a href="/proposals">Proposals</a>
          <a href="/create">Create</a>
          <a href="/about">About</a>
        </div>

        {/* Hamburger Icon */}
        <button 
          className={`hamburger ${isOpen ? 'is-active' : ''}`} 
          onClick={toggleMenu}
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
        >
          <span className="hamburger-box">
            <span className="hamburger-inner"></span>
          </span>
        </button>

        {/* Mobile Menu */}
        <div 
          ref={menuRef}
          className={`mobile-menu ${isOpen ? 'is-open' : ''}`}
        >
          <div className="mobile-menu-content">
            <div className="mobile-network-info">
              <span>Network:</span>
              <span className={`network-badge ${network}`}>
                {network.charAt(0).toUpperCase() + network.slice(1)}
              </span>
              {showWarning && (
                <div className="mismatch-alert">
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
