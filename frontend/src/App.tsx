import React, { useState, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import OnboardingTutorial from "./components/OnboardingTutorial";

// Placeholder page components — replace with real implementations
const ProposalList = React.lazy(() => import("./pages/ProposalList"));
const ProposalDetail = React.lazy(() => import("./pages/ProposalDetail"));
const VotingPanel = React.lazy(() => import("./pages/VotingPanel"));
const GovernanceDashboard = React.lazy(() => import("./pages/GovernanceDashboard").then(m => ({ default: m.GovernanceDashboard })));
const AdminPanel = React.lazy(() => import("./pages/AdminPanel"));
const VoterProfile = React.lazy(() => import("./pages/VoterProfile"));

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>("dashboard");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);

  // Monitor freighter wallet (simplified for demonstration)
  useEffect(() => {
    const freighter = (window as any).freighter;
    if (freighter) {
      freighter.isConnected().then((connected: boolean) => {
        if (connected) {
          freighter.getPublicKey().then((addr: string) => setConnectedAddress(addr));
        }
      });
    }
  }, []);

  const navigate = (page: string) => setCurrentPage(page);

  return (
    <ErrorBoundary section="App">
      <OnboardingTutorial />
      {/* Skip navigation link — allows keyboard users to bypass repeated nav (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Navbar onNavigate={navigate} currentPage={currentPage} />

      <main id="main-content" style={{ padding: "1rem" }}>
        <React.Suspense fallback={<p>Loading…</p>}>
          {currentPage === "dashboard" && (
            <ErrorBoundary section="Dashboard">
              <GovernanceDashboard />
            </ErrorBoundary>
          )}

          {currentPage === "proposals" && (
            <ErrorBoundary section="ProposalList">
              <ProposalList />
            </ErrorBoundary>
          )}

          {currentPage === "admin" && (
            <ErrorBoundary section="AdminPanel">
              <AdminPanel
                connectedAddress={connectedAddress}
                proposals={[]} // Pass real proposals here
                contractPaused={false}
                onPauseToggle={() => {}}
                onCancelProposal={() => {}}
                onExecuteProposal={() => {}}
                onUpdateQuorum={() => {}}
              />
            </ErrorBoundary>
          )}

          {currentPage === "profile" && (
            <ErrorBoundary section="VoterProfile">
              <VoterProfile
                address={connectedAddress || "Not connected"}
                votes={[]} // Pass real votes here
                proposals={[]} // Pass real proposals here
              />
            </ErrorBoundary>
          )}
        </React.Suspense>
      </main>
    </ErrorBoundary>
  );
}
