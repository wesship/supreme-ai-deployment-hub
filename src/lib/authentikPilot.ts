/** Public configuration only. The OIDC client secret belongs in Supabase Auth. */
export function authentikPilotEnabled(env: {
  MODE?: string;
  VITE_ENVIRONMENT?: string;
  VITE_AUTHENTIK_PILOT_ENABLED?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}): boolean {
  if (env.MODE !== 'staging' || env.VITE_ENVIRONMENT !== 'staging' ||
      env.VITE_AUTHENTIK_PILOT_ENABLED !== 'true') return false;

  // Never use the client's production URL fallback for the identity pilot.
  try {
    const url = new URL(env.VITE_SUPABASE_URL ?? '');
    return url.protocol === 'https:' &&
      url.origin === 'https://ypomzwhtaamxdmcwtpyf.supabase.co' &&
      url.pathname === '/' && url.search === '' && url.hash === '' &&
      url.username === '' && url.password === '' &&
      Boolean((env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim());
  } catch {
    return false;
  }
}
