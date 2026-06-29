import React from "react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import { ProposalSkeletonList } from "./components/ProposalCardSkeleton";
import OnboardingTutorial from "./components/OnboardingTutorial";
import { RpcStatus } from "./components/RpcStatus";
import { useSessionTimeoutWarning } from "./hooks/useSessionTimeoutWarning";

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
      Loading pageâ€¦
    </p>
  );
}

export default function App() {
  const { t } = useTranslation();
  const { warningVisible, secondsUntilExpiry, keepAlive } = useSessionTimeoutWarning();

  return (
    <ErrorBoundary section="App">
      <OnboardingTutorial />
      {/* Skip navigation link â€” allows keyboard users to bypass repeated nav (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">
        {t("nav.skipToMain")}
      </a>

      <Navbar />

      {warningVisible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            background: '#1e3a8a',
            color: '#ebf8ff',
            padding: '1rem',
            margin: '0 1rem 1rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>
              Session expires soon â€” refresh now to keep your proposal data current.
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.95rem' }}>
              Auto-logout in {secondsUntilExpiry} second{secondsUntilExpiry === 1 ? '' : 's'} if there is no activity.
            </p>
          </div>
          <button
            type="button"
            onClick={keepAlive}
            style={{
              background: '#ffffff',
              color: '#1e3a8a',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.75rem 1rem',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Stay signed in
          </button>
        </div>
      )}

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
