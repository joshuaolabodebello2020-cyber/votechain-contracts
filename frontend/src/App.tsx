import React from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GovernanceDashboard } from "./pages/GovernanceDashboard";

export default function App() {
  return (
    <ErrorBoundary section="App">
      <GovernanceDashboard />
    </ErrorBoundary>
  );
}
