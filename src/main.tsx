import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import './styles/d3vonn-new-ui.css';
import './styles/d3vonn-design-system.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found. Check your index.html.');
}

const root = createRoot(rootElement);

const readableError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error || 'Unknown client error');

function StartupShell() {
  return (
    <div
      data-d3vonn-boot="loading"
      className="flex min-h-screen items-center justify-center bg-[#020714] px-6 text-white"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-300/30 border-t-blue-200" />
        <p className="mt-5 text-sm font-semibold tracking-wide">Preparing D3VONN.IO</p>
        <p className="mt-2 text-xs text-blue-100/55">Loading the governed intelligence workspace</p>
      </div>
    </div>
  );
}

function StartupFailure({ stage, error }: { stage: string; error: unknown }) {
  return (
    <div
      data-d3vonn-boot="failed"
      data-d3vonn-boot-stage={stage}
      className="flex min-h-screen items-center justify-center bg-[#020714] px-6 text-white"
      role="alert"
    >
      <div className="w-full max-w-xl rounded-2xl border border-red-300/20 bg-red-500/[0.06] p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200/70">Client startup guard</p>
        <h1 className="mt-3 text-2xl font-bold">D3VONN.IO could not finish loading.</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          The client failure was captured instead of leaving an empty application root.
        </p>
        <p className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3 font-mono text-xs text-red-100/80">
          {stage}: {readableError(error)}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 min-h-11 rounded-xl border border-blue-200/20 bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Reload D3VONN.IO
        </button>
      </div>
    </div>
  );
}

type RootErrorBoundaryProps = { children: ReactNode };
type RootErrorBoundaryState = { error: Error | null };

class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[D3VONN] React root render failed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <StartupFailure stage="react-render" error={this.state.error} />;
    }
    return this.props.children;
  }
}

// Paint a deterministic shell before importing the application tree. If a
// top-level App dependency fails during module evaluation, the user sees a
// diagnostic state instead of an empty #root.
root.render(<StartupShell />);

void import('./App.tsx')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <RootErrorBoundary>
          <HelmetProvider>
            <QueryClientProvider client={queryClient}>
              <App />
            </QueryClientProvider>
          </HelmetProvider>
        </RootErrorBoundary>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('[D3VONN] App module import failed:', error);
    root.render(<StartupFailure stage="app-import" error={error} />);
  });

// Initialize Sentry AFTER first paint (non-blocking).
const initializeSentry = () => {
  import('./lib/sentry')
    .then(({ initSentry }) => {
      try {
        initSentry();
      } catch (error) {
        console.error('Sentry init failed:', error);
      }
    })
    .catch((error) => console.error('Sentry module load failed:', error));
};

if ('requestIdleCallback' in window) {
  (window as Window & { requestIdleCallback: (callback: () => void) => number }).requestIdleCallback(
    initializeSentry,
  );
} else {
  setTimeout(initializeSentry, 2000);
}
