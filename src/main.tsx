import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import ExuBrandOverlay from './components/brand/ExuBrandOverlay';
import './index.css';
import './styles/d3vonn-new-ui.css';

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
  throw new Error(
    'Root element #root not found. Check your index.html.'
  );
}

// Render immediately — don't block on Sentry
createRoot(rootElement).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <App />
        <ExuBrandOverlay />
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>
);

// Initialize Sentry AFTER first paint (non-blocking)
if ('requestIdleCallback' in window) {
  (window as any).requestIdleCallback(() => {
    import('./lib/sentry').then(({ initSentry }) => {
      try { initSentry(); } catch (err) { console.error("Sentry init failed:", err); }
    });
  });
} else {
  setTimeout(() => {
    import('./lib/sentry').then(({ initSentry }) => {
      try { initSentry(); } catch (err) { console.error("Sentry init failed:", err); }
    });
  }, 2000);
}