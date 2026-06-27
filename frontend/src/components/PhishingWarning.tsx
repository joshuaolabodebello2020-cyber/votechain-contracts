import React, { useState } from "react";

const STORAGE_KEY = "vc_phishing_warning_dismissed";

export function usePhishingWarning() {
  const [dismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  return !dismissed;
}

type Props = {
  onAcknowledge: () => void;
};

export function PhishingWarning({ onAcknowledge }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  function handleProceed() {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    onAcknowledge();
  }

  const domain = window.location.hostname;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="phishing-title" style={overlayStyle}>
      <div style={dialogStyle}>
        <h2 id="phishing-title" style={{ marginTop: 0, color: "#ffb300" }}>
          ⚠ Security Warning
        </h2>
        <p style={{ marginBottom: 8 }}>
          Before connecting your wallet, verify you are on the correct domain:
        </p>
        <p style={domainStyle}>{domain}</p>
        <p style={{ fontSize: 13, color: "#aaa", marginBottom: 16 }}>
          Phishing sites may impersonate this application. Never sign transactions on
          untrusted domains. If this domain looks unfamiliar, close this tab immediately.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 16, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          Don't show again on this device
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleProceed} style={proceedBtnStyle}>
            I understand, proceed
          </button>
          <button onClick={() => window.history.back()} style={cancelBtnStyle}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
};
const dialogStyle: React.CSSProperties = {
  background: "#1e1e1e", border: "1px solid #ffb300", borderRadius: 8,
  padding: 24, maxWidth: 420, width: "90%", color: "#e0e0e0", fontFamily: "sans-serif",
};
const domainStyle: React.CSSProperties = {
  background: "#121212", border: "1px solid #444", borderRadius: 4,
  padding: "8px 12px", fontFamily: "monospace", fontSize: 16,
  color: "#66bb6a", marginBottom: 12, wordBreak: "break-all",
};
const proceedBtnStyle: React.CSSProperties = {
  background: "#ffb300", color: "#000", border: "none",
  borderRadius: 4, padding: "8px 16px", cursor: "pointer", fontWeight: 600,
};
const cancelBtnStyle: React.CSSProperties = {
  background: "transparent", color: "#aaa", border: "1px solid #444",
  borderRadius: 4, padding: "8px 16px", cursor: "pointer",
};
