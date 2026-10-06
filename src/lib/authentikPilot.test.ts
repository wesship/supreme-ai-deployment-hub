import { describe, expect, it } from 'vitest';
import { authentikPilotEnabled } from './authentikPilot';

const staging = {
  MODE: 'staging',
  VITE_ENVIRONMENT: 'staging',
  VITE_AUTHENTIK_PILOT_ENABLED: 'true',
  VITE_SUPABASE_URL: 'https://ypomzwhtaamxdmcwtpyf.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
};

describe('Authentik staging isolation', () => {
  it('permits the explicitly enabled canonical staging project', () => {
    expect(authentikPilotEnabled(staging)).toBe(true);
  });
  it.each([
    ['default off', { VITE_AUTHENTIK_PILOT_ENABLED: undefined }],
    ['false flag', { VITE_AUTHENTIK_PILOT_ENABLED: 'false' }],
    ['production build', { MODE: 'production' }],
    ['development build', { MODE: 'development' }],
    ['production environment', { VITE_ENVIRONMENT: 'production' }],
    ['production project', { VITE_SUPABASE_URL: 'https://tjygexesognbkwualywq.supabase.co' }],
    ['another tenant project', { VITE_SUPABASE_URL: 'https://other.supabase.co' }],
    ['missing URL', { VITE_SUPABASE_URL: undefined }],
    ['HTTP URL', { VITE_SUPABASE_URL: 'http://ypomzwhtaamxdmcwtpyf.supabase.co' }],
    ['missing public key', { VITE_SUPABASE_PUBLISHABLE_KEY: undefined }],
    ['URL credentials', { VITE_SUPABASE_URL: 'https://user:password@ypomzwhtaamxdmcwtpyf.supabase.co' }],
    ['URL path', { VITE_SUPABASE_URL: 'https://ypomzwhtaamxdmcwtpyf.supabase.co/auth' }],
    ['URL query', { VITE_SUPABASE_URL: 'https://ypomzwhtaamxdmcwtpyf.supabase.co?project=production' }],
  ])('blocks %s', (_name, overrides) => {
    expect(authentikPilotEnabled({ ...staging, ...overrides })).toBe(false);
  });
  it('supports the existing legacy browser-key variable', () => {
    expect(authentikPilotEnabled({ ...staging, VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
      VITE_SUPABASE_ANON_KEY: 'public-test-key' })).toBe(true);
  });
});
