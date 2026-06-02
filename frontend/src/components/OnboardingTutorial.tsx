import React, { useState, useEffect } from "react";

interface Step {
  title: string;
  content: string;
  target: string; // CSS selector or description
}

const STEPS: Step[] = [
  {
    title: "Welcome to VoteChain!",
    content: "This tutorial will guide you through your first steps in decentralized governance.",
    target: "body",
  },
  {
    title: "Connect Your Wallet",
    content: "First, connect your Freighter wallet to interact with the Stellar blockchain.",
    target: "nav",
  },
  {
    title: "Browse Proposals",
    content: "Explore active proposals that need your vote. You can search and filter the list.",
    target: "#proposal-list-heading",
  },
  {
    title: "Cast Your Vote",
    content: "Click on a proposal to view details and cast your Yes, No, or Abstain vote.",
    target: "table",
  },
];

export default function OnboardingTutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("votechain_onboarding_seen");
    if (!hasSeenTutorial) {
      setIsVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem("votechain_onboarding_seen", "true");
    setIsVisible(false);
  };

  const next = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      dismiss();
    }
  };

  if (!isVisible) return null;

  const step = STEPS[currentStep];

  return (
    <div className="onboarding-overlay" style={overlayStyle}>
      <div className="onboarding-card card" style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3>{step.title}</h3>
          <button onClick={dismiss} className="btn-sm" aria-label="Dismiss tutorial">
            ✕
          </button>
        </div>
        <p>{step.content}</p>
        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <button onClick={next} className="btn-primary">
            {currentStep === STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const cardStyle: React.CSSProperties = {
  maxWidth: "400px",
  width: "90%",
  padding: "2rem",
  background: "#1e1e1e",
  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
};
