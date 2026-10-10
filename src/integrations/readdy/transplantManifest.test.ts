import { describe, expect, it } from 'vitest';

import { READDY_MARKETING_ROUTES } from './marketingSurfaces';
import {
  getReaddyTransplantTarget,
  READDY_DESIGN_SYSTEM_HOSTS,
  READDY_TRANSPLANT_TARGETS,
} from './transplantManifest';

describe('Readdy visual transplant manifest', () => {
  it('maps every approved Readdy marketing route to exactly one canonical page file', () => {
    const pageFiles = READDY_MARKETING_ROUTES.map((route) => {
      const target = getReaddyTransplantTarget(route);
      expect(target.route).toBe(route);
      expect(target.mode).toBe('presentation-only');
      expect(target.pageFile).toBe(READDY_TRANSPLANT_TARGETS[route].pageFile);
      return target.pageFile;
    });

    expect(new Set(pageFiles).size).toBe(READDY_MARKETING_ROUTES.length);
  });

  it.each([
    '/app',
    '/dashboard',
    '/admin',
    '/marketplace',
    '/moneyhub',
    '/film',
    '/voice-studio',
    '/security/ops',
    '/api',
  ])('refuses to resolve protected route %s as a Readdy transplant target', (route) => {
    expect(() => getReaddyTransplantTarget(route)).toThrow(/not allowed on protected route/i);
  });

  it('pins Readdy token reconciliation to the existing D3VONN design-system hosts', () => {
    expect(READDY_DESIGN_SYSTEM_HOSTS).toEqual([
      'src/index.css',
      'tailwind.config.ts',
    ]);
  });
});
