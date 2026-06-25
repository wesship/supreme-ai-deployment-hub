import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';

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
      <App />
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
