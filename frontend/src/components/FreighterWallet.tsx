import React, { useEffect, useState } from "react";

const STELLAR_NETWORK = "TESTNET";
const FREIGHTER_DOWNLOAD = "https://www.freighter.app/";

type WalletState = {
  address: string | null;
  network: string | null;
  connected: boolean;
};

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function FreighterWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    network: null,
    connected: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if already connected on mount
  useEffect(() => {
    const freighter = (window as any).freighter;
    if (!freighter) return;
    freighter.isConnected().then((connected: boolean) => {
      if (connected) {
        freighter.getPublicKey().then((address: string) => {
          freighter.getNetwork().then((network: string) => {
            setWallet({ address, network, connected: true });
          });
        });
      }
    });
  }, []);

  async function connect() {
    const freighter = (window as any).freighter;
    if (!freighter) {
      setError("Freighter extension not found. Please install it first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await freighter.requestAccess();
      const address: string = await freighter.getPublicKey();
      const network: string = await freighter.getNetwork();
      setWallet({ address, network, connected: true });
    } catch (e: any) {
      setError(e?.message ?? "Failed to connect wallet.");
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setWallet({ address: null, network: null, connected: false });
    setError(null);
  }

  const networkMismatch =
    wallet.connected &&
    wallet.network &&
    wallet.network.toUpperCase() !== STELLAR_NETWORK;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {!wallet.connected ? (
        <button onClick={connect} disabled={loading} aria-label="Connect Freighter Wallet">
          {loading ? "Connecting…" : "Connect Wallet"}
        </button>
      ) : (
        <>
          <span title={wallet.address ?? ""} aria-label="Connected wallet address">
            {truncate(wallet.address!)}
          </span>
          <button onClick={disconnect} aria-label="Disconnect wallet">
            Disconnect
          </button>
        </>
      )}

      {networkMismatch && (
        <span role="alert" style={{ color: "orange" }}>
          ⚠ Network mismatch: connected to {wallet.network}, expected {STELLAR_NETWORK}
        </span>
      )}

      {error && (
        <span role="alert" style={{ color: "red" }}>
          {error}{" "}
          {error.includes("not found") && (
            <a href={FREIGHTER_DOWNLOAD} target="_blank" rel="noreferrer">
              Install Freighter
            </a>
          )}
        </span>
      )}
    </div>
  );
}
