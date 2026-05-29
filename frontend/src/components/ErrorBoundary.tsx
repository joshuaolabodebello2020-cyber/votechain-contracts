import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional section name for monitoring context */
  section?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to monitoring service (replace with real integration, e.g. Sentry)
    console.error(
      `[ErrorBoundary]${this.props.section ? ` [${this.props.section}]` : ""}`,
      error,
      info.componentStack,
    );
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: "1.5rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <p>
            {this.props.section
              ? `The "${this.props.section}" section failed to load.`
              : "An unexpected error occurred."}
          </p>
          <button onClick={this.handleRetry} aria-label="Retry loading this section">Try again</button>
        </div>
      );
    }

    return this.props.children;
  }
}
