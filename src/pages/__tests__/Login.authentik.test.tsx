import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth } }));
vi.mock('@/components/index/D3vonnPageBanner', () => ({ default: () => null }));
vi.mock('framer-motion', () => ({ motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('MODE', 'staging');
  vi.stubEnv('VITE_ENVIRONMENT', 'staging');
  vi.stubEnv('VITE_AUTHENTIK_PILOT_ENABLED', 'true');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://ypomzwhtaamxdmcwtpyf.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  auth.signInWithOAuth.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
const showLogin = () => render(<MemoryRouter initialEntries={['/login?redirect=%2Fapp']}><Login /></MemoryRouter>);

describe('Authentik login pilot', () => {
  it('keeps the pilot hidden by default and retains existing sign-in', () => {
    vi.stubEnv('VITE_AUTHENTIK_PILOT_ENABLED', 'false');
    showLogin();
    expect(screen.queryByRole('button', { name: 'Continue with Authentik' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
  it('cannot expose the pilot in a production build', () => {
    vi.stubEnv('MODE', 'production');
    showLogin();
    expect(screen.queryByRole('button', { name: 'Continue with Authentik' })).toBeNull();
  });
  it('uses Supabase OAuth and the existing callback with the return path', async () => {
    showLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Authentik' }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'custom:authentik', options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=%2Fapp`,
      },
    }));
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  });
  it('reports provider failure and re-enables sign-in', async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: { message: 'Provider unavailable' } });
    showLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Authentik' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable');
    expect(screen.getByRole('button', { name: 'Continue with Authentik' })).toBeEnabled();
  });
});
