import { FreighterWallet } from "./FreighterWallet";

interface Props {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export default function Navbar({ onNavigate, currentPage }: Props) {
  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "proposals", label: "Proposals" },
    { id: "admin", label: "Admin Panel" },
    { id: "profile", label: "My Profile" },
  ];

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
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <span
          style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fff", cursor: "pointer" }}
          onClick={() => onNavigate("dashboard")}
        >
          VoteChain
        </span>
        <div style={{ display: "flex", gap: "1rem" }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                background: "none",
                border: "none",
                color: currentPage === item.id ? "#42a5f5" : "#888",
                cursor: "pointer",
                fontWeight: currentPage === item.id ? 600 : 400,
                fontSize: "0.9rem",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <FreighterWallet />
    </nav>
  );
}
