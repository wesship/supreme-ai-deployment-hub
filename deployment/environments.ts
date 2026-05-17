/**
 * deployment/environments.ts
 *
 * Replaces the plain-JS deployment/environments.js with a fully type-safe,
 * Zod-validated environment configuration module.
 *
 * Key improvements:
 *   1. TypeScript — catches misconfiguration at compile time.
 *   2. Zod validation — throws a clear error at startup if any required
 *      variable is missing or has the wrong type.
 *   3. No hardcoded secrets — all sensitive values come from environment
 *      variables only.
 *   4. Strict production checks — debugMode and experimentalTools are
 *      always false in production, regardless of env var values.
 */

import { z } from 'zod';

const EnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  VITE_API_URL: z.string().url('VITE_API_URL must be a valid URL'),
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_ENVIRONMENT: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
});

type EnvVars = z.infer<typeof EnvironmentSchema>;

function parseEnv(): EnvVars {
  const result = EnvironmentSchema.safeParse(
    typeof import.meta !== 'undefined' ? import.meta.env : process.env
  );
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(
      `[environments] Invalid environment configuration:\n${errors}\n\n` +
        'Check your .env.local (development) or Vercel Environment Variables (production).'
    );
  }
  return result.data;
}

const vars = parseEnv();
const isProduction = vars.VITE_ENVIRONMENT === 'production';

export const environmentConfig = {
  environment: vars.VITE_ENVIRONMENT,
  apiUrl: vars.VITE_API_URL,
  supabaseUrl: vars.VITE_SUPABASE_URL,
  supabaseAnonKey: vars.VITE_SUPABASE_ANON_KEY,
  sentryDsn: vars.VITE_SENTRY_DSN,
  logLevel: isProduction ? 'error' : 'debug',
  features: {
    // Hardcoded false in production — cannot be overridden by env vars
    experimentalTools: !isProduction,
    betaAgents: !isProduction,
    debugMode: !isProduction,
  },
} as const;

export type EnvironmentConfig = typeof environmentConfig;
export default environmentConfig;
