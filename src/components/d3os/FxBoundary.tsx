import React from 'react';

interface FxBoundaryProps {
  children: React.ReactNode;
  /** Rendered when the effect fails or is still loading. */
  fallback: React.ReactNode;
}

interface FxBoundaryState {
  failed: boolean;
}

/**
 * Error boundary for advanced visual effects. A broken canvas/WebGL effect must
 * never take the page down — it degrades to the static fallback instead.
 */
class FxBoundary extends React.Component<FxBoundaryProps, FxBoundaryState> {
  state: FxBoundaryState = { failed: false };

  static getDerivedStateFromError(): FxBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) {
      console.warn('[d3os] visual effect failed, using static fallback', error);
    }
  }

  render() {
    if (this.state.failed) return <>{this.props.fallback}</>;
    return (
      <React.Suspense fallback={this.props.fallback}>{this.props.children}</React.Suspense>
    );
  }
}

export default FxBoundary;
