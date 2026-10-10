import { describe, expect, it } from 'vitest';

import {
  assertReaddyMarketingRoute,
  isReaddyMarketingRoute,
  READDY_MARKETING_ROUTES,
} from './marketingSurfaces';

describe('Readdy marketing boundary', () => {
  it('allows only the approved public marketing surfaces', () => {
    for (const route of READDY_MARKETING_ROUTES) {
      expect(isReaddyMarketingRoute(route)).toBe(true);
      expect(assertReaddyMarketingRoute(route)).toBe(route);
    }
  });

  it.each([
    '/app',
    '/dashboard',
    '/marketplace',
    '/film',
    '/voice-studio',
    '/moneyhub',
    '/security',
    '/security/ops',
    '/admin',
    '/api',
  ])('rejects protected surface %s', (route) => {
    expect(isReaddyMarketingRoute(route)).toBe(false);
    expect(() => assertReaddyMarketingRoute(route)).toThrow(/not allowed on protected route/i);
  });

  it('normalizes trailing slashes without broadening the allowlist', () => {
    expect(assertReaddyMarketingRoute('/solutions/')).toBe('/solutions');
    expect(() => assertReaddyMarketingRoute('/app/')).toThrow();
  });
});
