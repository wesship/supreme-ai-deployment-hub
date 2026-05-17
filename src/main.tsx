import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry';

// Initialize Sentry error tracking before rendering
initSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error(
    'Root element #root not found. Check your index.html.'
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
