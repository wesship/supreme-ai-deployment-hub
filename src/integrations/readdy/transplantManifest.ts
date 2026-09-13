import {
  assertReaddyMarketingRoute,
  type ReaddyMarketingRoute,
} from './marketingSurfaces';

export const READDY_TRANSPLANT_TARGETS = {
  '/': {
    pageFile: 'src/pages/Index.tsx',
    mode: 'presentation-only',
  },
  '/solutions': {
    pageFile: 'src/pages/Solutions.tsx',
    mode: 'presentation-only',
  },
  '/ai-agents': {
    pageFile: 'src/pages/AIAgents.tsx',
    mode: 'presentation-only',
  },
  '/pricing': {
    pageFile: 'src/pages/Pricing.tsx',
    mode: 'presentation-only',
  },
  '/about': {
    pageFile: 'src/pages/About.tsx',
    mode: 'presentation-only',
  },
  '/resources': {
    pageFile: 'src/pages/Resources.tsx',
    mode: 'presentation-only',
  },
} as const satisfies Record<
  ReaddyMarketingRoute,
  { pageFile: string; mode: 'presentation-only' }
>;

/**
 * Readdy visual tokens must be reconciled into these existing D3VONN design-system
 * hosts rather than replacing the application's global styling/config wholesale.
 */
export const READDY_DESIGN_SYSTEM_HOSTS = [
  'src/index.css',
  'tailwind.config.ts',
] as const;

export function getReaddyTransplantTarget(pathname: string) {
  const route = assertReaddyMarketingRoute(pathname);
  return {
    route,
    ...READDY_TRANSPLANT_TARGETS[route],
  };
}
