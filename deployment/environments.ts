/**
 * deployment/environments.ts
 *
 * Type-safe, Zod-validated environment configuration module.
 */

import { z } from 'zod';

const rawEnv = typeof import.meta !== 'undefined' ? import.meta.env : process.env;

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

function normalizeEnv(env: typeof rawEnv) {
  return {
    ...env,
    VITE_SUPABASE_ANON_KEY:
      env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

function parseEnv(): EnvVars {
  const result = EnvironmentSchema.safeParse(normalizeEnv(rawEnv));

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(
      `[environments] Invalid environment configuration:\n${errors}\n\n` +
        'Check your local env file or Vercel Environment Variables.'
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
    experimentalTools: !isProduction,
    betaAgents: !isProduction,
    debugMode: !isProduction,
  },
} as const;

export type EnvironmentConfig = typeof environmentConfig;
export default environmentConfig;
