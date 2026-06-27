import React, { Component, ErrorInfo, ReactNode } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

interface Props extends WithTranslation {
  children: ReactNode;
  section?: string;
}

interface State {
  error: Error | null;
}

class ErrorBoundaryBase extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[ErrorBoundary]${this.props.section ? ` [${this.props.section}]` : ''}`,
      error,
      info.componentStack,
    );
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { t, section } = this.props;

    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h2>{t('errors:somethingWentWrong')}</h2>
          <p>
            {section
              ? t('errors:sectionFailed', { section })
              : t('errors:unexpectedError')}
          </p>
          <button onClick={this.handleRetry} aria-label={t('errors:retryAriaLabel')}>
            {t('common:tryAgain')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryBase);
