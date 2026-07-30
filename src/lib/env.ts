/**
 * env.ts — Centralised, type-safe public environment configuration.
 *
 * IMPORTANT: use only direct import.meta.env.VITE_* property access in this file.
 * Dynamic access such as import.meta.env[key] forces Vite to serialize the entire
 * client environment object and can expose unrelated VITE_* values in the bundle.
 *
 * Required public deployment variables:
 *   VITE_API_URL
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY
 *
 * Optional public variables:
 *   VITE_SENTRY_DSN
 *   VITE_ENVIRONMENT
 *
 * NEVER prefix provider credentials or other secrets with VITE_.
 * OPENAI_API_KEY, PINECONE_API_KEY, RESEND_API_KEY, JWT_SECRET, and similar
 * credentials must remain server-side only.
 */

const PUBLIC_ENV = {
  apiUrl: import.meta.env.VITE_API_URL as string | undefined,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: import.meta.env.VITE_ENVIRONMENT as string | undefined,
} as const;

function requireValue(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${key}\n` +
        'Add it to your .env.local (development) or deployment environment variables (production).',
    );
  }
  return value;
}

function requireAnyValue(entries: ReadonlyArray<readonly [string, string | undefined]>): string {
  for (const [, value] of entries) {
    if (value) return value;
  }

  throw new Error(
    `[env] Missing required environment variable. Set one of: ${entries
      .map(([key]) => key)
      .join(', ')}\n` +
      'Add it to your .env.local (development) or deployment environment variables (production).',
  );
}

export const env = {
  /** Backend FastAPI base URL */
  apiUrl: requireValue('VITE_API_URL', PUBLIC_ENV.apiUrl),

  /** Supabase project URL */
  supabaseUrl: requireValue('VITE_SUPABASE_URL', PUBLIC_ENV.supabaseUrl),

  /** Supabase public key — safe to expose in browser */
  supabaseAnonKey: requireAnyValue([
    ['VITE_SUPABASE_PUBLISHABLE_KEY', PUBLIC_ENV.supabasePublishableKey],
    ['VITE_SUPABASE_ANON_KEY', PUBLIC_ENV.supabaseAnonKey],
  ]),

  /** Sentry DSN for browser error tracking (public by design) */
  sentryDsn: PUBLIC_ENV.sentryDsn ?? '',

  /** Current environment name */
  environment: (PUBLIC_ENV.environment ?? 'development') as
    | 'development'
    | 'staging'
    | 'production',

  /** Whether debug mode is active */
  isDebug: import.meta.env.DEV,

  /** Whether running in production */
  isProduction: import.meta.env.PROD,
} as const;

export type Env = typeof env;
