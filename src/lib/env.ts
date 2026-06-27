/**
 * env.ts — Centralised, type-safe environment configuration
 *
 * Replaces the insecure deployment/environments.js (plain JS, no type safety,
 * no validation) and the deployment/env-config.template.ts (which referenced
 * process.env directly in the browser bundle, leaking build-time values).
 *
 * All runtime config is read from import.meta.env (Vite) which:
 *   1. Only exposes variables prefixed with VITE_ to the browser bundle.
 *   2. Replaces values at build time — secrets are never in the bundle.
 *   3. Throws at startup if a required variable is missing.
 *
 * Required Vercel / .env.local variables:
 *   VITE_API_URL          — Backend API base URL
 *   VITE_SUPABASE_URL     — Supabase project URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY — Supabase public key
 *   VITE_SENTRY_DSN       — Sentry DSN (optional but recommended)
 *
 * NEVER prefix secrets (OPENAI_API_KEY, JWT_SECRET, etc.) with VITE_.
 * Those must stay server-side only.
 */

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${key}\n` +
      `Add it to your .env.local (development) or deployment environment variables (production).`
    );
  }
  return value as string;
}

function optionalEnv(key: string, fallback = ''): string {
  return (import.meta.env[key] as string | undefined) ?? fallback;
}

function requireAnyEnv(keys: string[]): string {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (value) return value as string;
  }

  throw new Error(
    `[env] Missing required environment variable. Set one of: ${keys.join(', ')}\n` +
    `Add it to your .env.local (development) or deployment environment variables (production).`
  );
}

export const env = {
  /** Backend FastAPI base URL */
  apiUrl: requireEnv('VITE_API_URL'),

  /** Supabase project URL */
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),

  /** Supabase public key — safe to expose in browser */
  supabaseAnonKey: requireAnyEnv(['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY']),

  /** Sentry DSN for error tracking (optional) */
  sentryDsn: optionalEnv('VITE_SENTRY_DSN'),

  /** Current environment name */
  environment: optionalEnv('VITE_ENVIRONMENT', 'development') as
    | 'development'
    | 'staging'
    | 'production',

  /** Whether debug mode is active */
  isDebug: import.meta.env.DEV,

  /** Whether running in production */
  isProduction: import.meta.env.PROD,
} as const;

export type Env = typeof env;
// Production API: https://api.d3vonn.io
