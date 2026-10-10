export type RuntimeEnvironment = "development" | "staging" | "production";

function requireValue(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function readBrowserSafeConfig(env: Record<string, string | undefined>) {
  return {
    environment: (env.VITE_ENVIRONMENT ?? "development") as RuntimeEnvironment,
    supabaseUrl: requireValue(env, "VITE_SUPABASE_URL"),
    supabasePublishableKey: requireValue(env, "VITE_SUPABASE_PUBLISHABLE_KEY"),
    apiUrl: requireValue(env, "VITE_API_URL"),
  };
}

export function readServerConfig(env: Record<string, string | undefined>) {
  return {
    supabaseUrl: requireValue(env, "SUPABASE_URL"),
    supabaseServiceRoleKey: requireValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
  };
}
