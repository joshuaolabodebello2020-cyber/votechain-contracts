import React from "react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import { ProposalSkeletonList } from "./components/ProposalCardSkeleton";
import OnboardingTutorial from "./components/OnboardingTutorial";
import { RpcStatus } from "./components/RpcStatus";
import { SessionTimeoutWarning } from "./components/SessionTimeoutWarning";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { useProposals } from "./hooks/useProposals";
import { useWalletStore } from "./store";

const ProposalList = React.lazy(() => import("./pages/ProposalList"));
const ProposalDetail = React.lazy(() => import("./pages/ProposalDetail"));
const VotingPanel = React.lazy(() => import("./pages/VotingPanel"));
const VoteHistoryPage = React.lazy(() => import("./pages/VoteHistoryPage"));

/**
 * Generic page-level fallback for lazy chunks that don't have a
 * dedicated skeleton (ProposalDetail, VotingPanel, etc.).
 */
function PageFallback() {
  return (
    <p className="sr-only" aria-live="polite">
      Loading page…
    </p>
  );
}

export default function App() {
  const { t } = useTranslation();
  const { refresh } = useProposals();
  const disconnect = useWalletStore((s) => s.disconnect);

  const { showWarning, resetSession } = useSessionTimeout({
    onExpired: disconnect,
    onRefresh: refresh,
  });

  return (
    <ErrorBoundary section="App">
      <OnboardingTutorial />
      {/* Skip navigation link — allows keyboard users to bypass repeated nav (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">
        {t("nav.skipToMain")}
      </a>

      <Navbar />

      {showWarning && <SessionTimeoutWarning onDismiss={resetSession} />}

      <main id="main-content">
        <div className="container">
          <RpcStatus />
        </div>
        {/*
         * ProposalList gets a proper skeleton fallback while the JS chunk is
         * downloading so users see a meaningful placeholder immediately.
         */}
        <ErrorBoundary section="ProposalList">
          <React.Suspense
            fallback={
              <div className="container">
                <ProposalSkeletonList count={5} />
              </div>
            }
          >
            <ProposalList />
          </React.Suspense>
        </ErrorBoundary>

        <ErrorBoundary section="ProposalDetail">
          <React.Suspense fallback={<PageFallback />}>
            <ProposalDetail />
          </React.Suspense>
        </ErrorBoundary>

        <ErrorBoundary section="VotingPanel">
          <React.Suspense fallback={<PageFallback />}>
            <VotingPanel />
          </React.Suspense>
        </ErrorBoundary>
      </main>
    </ErrorBoundary>
  );
}
