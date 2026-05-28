import { FreighterWallet } from "./FreighterWallet";

export default function Navbar() {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.5rem",
        background: "#1e1e1e",
        borderBottom: "1px solid #333",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fff" }}>VoteChain</span>
      <FreighterWallet />
    </nav>
  );
}
