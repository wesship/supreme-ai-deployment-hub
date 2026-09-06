export const READDY_MARKETING_ROUTES = [
  '/',
  '/solutions',
  '/ai-agents',
  '/pricing',
  '/about',
  '/resources',
] as const;

export type ReaddyMarketingRoute = (typeof READDY_MARKETING_ROUTES)[number];

const READDY_MARKETING_ROUTE_SET = new Set<string>(READDY_MARKETING_ROUTES);

/**
 * Readdy is a presentation donor only. It must never become an authority for
 * authenticated application, billing, marketplace, AI Films, MoneyHub,
 * Security Ops, Voice Studio, or API routes.
 */
export function isReaddyMarketingRoute(pathname: string): pathname is ReaddyMarketingRoute {
  const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  return READDY_MARKETING_ROUTE_SET.has(normalized);
}

export function assertReaddyMarketingRoute(pathname: string): ReaddyMarketingRoute {
  const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  if (!isReaddyMarketingRoute(normalized)) {
    throw new Error(`Readdy integration is not allowed on protected route: ${pathname}`);
  }
  return normalized;
}
