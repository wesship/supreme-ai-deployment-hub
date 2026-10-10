import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

/**
 * ErrorBoundary — catches unhandled React render errors and reports them to
 * Sentry. Wrap top-level routes or critical UI sections with this component.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyPage />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, eventId: null };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId });
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, eventId: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-bold text-destructive">
            Something went wrong
          </h1>
          <p className="max-w-md text-muted-foreground">
            An unexpected error occurred. Our team has been notified. Please
            try refreshing the page.
          </p>
          <div className="flex gap-3">
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={this.handleReset}
            >
              Try again
            </button>
            {this.state.eventId && (
              <button
                className="rounded-md border px-4 py-2 text-sm"
                onClick={() =>
                  Sentry.showReportDialog({ eventId: this.state.eventId! })
                }
              >
                Report feedback
              </button>
            )}
          </div>
          {import.meta.env.DEV && (
            <p className="mt-4 rounded bg-muted p-2 font-mono text-xs text-muted-foreground">
              Event ID: {this.state.eventId}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
