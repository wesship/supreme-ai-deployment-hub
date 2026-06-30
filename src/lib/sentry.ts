/**
 * sentry.ts — D3VONN Frontend Error Tracking
 *
 * Initializes Sentry for browser error tracking, performance monitoring,
 * and session replay. Import and call initSentry() in src/main.tsx before
 * the React root is rendered.
 *
 * Required environment variables (add to Vercel and GitHub Actions):
 *   VITE_SENTRY_DSN        — Sentry project DSN (safe to expose in frontend)
 *   VITE_APP_VERSION       — App version, set by semantic-release (e.g., "1.2.3")
 *
 * Install: npm install @sentry/react
 */

import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Skip in development or if DSN is not configured
  if (!dsn || import.meta.env.DEV) {
    console.debug('[Sentry] Skipped — not configured or running in development mode.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || 'unknown',

    integrations: [
      // Automatic performance tracing for React Router and fetch/XHR
      Sentry.browserTracingIntegration(),
      // Session replay — records user interactions on error
      Sentry.replayIntegration({
        maskAllText: true,          // GDPR: mask all text content
        blockAllMedia: true,        // GDPR: block all media
      }),
    ],

    // Capture 10% of transactions for performance monitoring
    // Increase to 1.0 during debugging, reduce to 0.01 in high-traffic prod
    tracesSampleRate: 0.1,

    // Capture 2% of all sessions for replay
    replaysSessionSampleRate: 0.02,

    // Capture 100% of sessions that contain an error
    replaysOnErrorSampleRate: 1.0,

    // Filter out noise — do not send errors from browser extensions
    beforeSend(event) {
      // Ignore errors from browser extensions
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        (frame) => frame.filename?.includes('chrome-extension://')
      )) {
        return null;
      }
      return event;
    },
  });
}

/**
 * Wrap a React component with Sentry's error boundary.
 * Usage: export default withSentryErrorBoundary(MyComponent, { fallback: <ErrorPage /> });
 */
export const withSentryErrorBoundary = Sentry.withErrorBoundary;

/**
 * Manually capture an exception with additional context.
 * Usage: captureError(error, { userId: '123', action: 'checkout' });
 */
export function captureError(
  error: unknown,
  context?: Record<string, string | number | boolean>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}
