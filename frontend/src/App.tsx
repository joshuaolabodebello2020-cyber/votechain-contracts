import React from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Placeholder page components — replace with real implementations
const ProposalList = React.lazy(() => import("./pages/ProposalList"));
const ProposalDetail = React.lazy(() => import("./pages/ProposalDetail"));
const VotingPanel = React.lazy(() => import("./pages/VotingPanel"));

export default function App() {
  return (
    <ErrorBoundary section="App">
      {/* Skip navigation link — allows keyboard users to bypass repeated nav (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <main id="main-content">
        <ErrorBoundary section="ProposalList">
          <React.Suspense fallback={<p>Loading…</p>}>
            <ProposalList />
          </React.Suspense>
        </ErrorBoundary>

        <ErrorBoundary section="ProposalDetail">
          <React.Suspense fallback={<p>Loading…</p>}>
            <ProposalDetail />
          </React.Suspense>
        </ErrorBoundary>

        <ErrorBoundary section="VotingPanel">
          <React.Suspense fallback={<p>Loading…</p>}>
            <VotingPanel />
          </React.Suspense>
        </ErrorBoundary>
      </main>
    </ErrorBoundary>
  );
}
