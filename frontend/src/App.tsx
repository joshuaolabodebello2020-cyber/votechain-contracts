import React from "react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";

const ProposalList = React.lazy(() => import("./pages/ProposalList"));
const ProposalDetail = React.lazy(() => import("./pages/ProposalDetail"));
const VotingPanel = React.lazy(() => import("./pages/VotingPanel"));
const VoteHistoryPage = React.lazy(() => import("./pages/VoteHistoryPage"));

export default function App() {
  const { t } = useTranslation();

  return (
    <ErrorBoundary section="App">
      {/* Skip navigation link — allows keyboard users to bypass repeated nav (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">
        {t("nav.skipToMain")}
      </a>

      <Navbar />

      <main id="main-content">
        <ErrorBoundary section="ProposalList">
          <React.Suspense fallback={<p>{t("loading")}</p>}>
            <ProposalList />
          </React.Suspense>
        </ErrorBoundary>

        <ErrorBoundary section="ProposalDetail">
          <React.Suspense fallback={<p>{t("loading")}</p>}>
            <ProposalDetail />
          </React.Suspense>
        </ErrorBoundary>

        <ErrorBoundary section="VotingPanel">
          <React.Suspense fallback={<p>{t("loading")}</p>}>
            <VotingPanel />
          </React.Suspense>
        </ErrorBoundary>
      </main>
    </ErrorBoundary>
  );
}
