import { useTranslation } from "react-i18next";
import { FreighterWallet } from "./FreighterWallet";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("nav.mainNavLabel")}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.5rem",
        background: "#1e1e1e",
        borderBottom: "1px solid #333",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#fff" }}>
        {t("nav.brand")}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <LanguageSwitcher />
        <FreighterWallet />
      </div>
    </nav>
  );
}
