import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { PublicHomepageRoutes } from './PublicHomepageApp';

const { canonicalRender } = vi.hoisted(() => ({ canonicalRender: vi.fn() }));
vi.mock('./pages/Index', () => ({ default: () => <Link to="/app">Enter the Platform</Link> }));
vi.mock('./components/ScrollToTop', () => ({ default: () => null }));
vi.mock('./App', () => ({ CanonicalAppShell: () => {
  canonicalRender();
  const { pathname } = useLocation();
  return <><p>Canonical route: {pathname}</p><Link to="/">Homepage</Link></>;
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Public homepage route handoff', () => {
  it('mounts the homepage without rendering the canonical shell', () => {
    render(<MemoryRouter><PublicHomepageRoutes /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Enter the Platform' })).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('main-content');
    expect(canonicalRender).not.toHaveBeenCalled();
  });

  it('delegates platform navigation to canonical routing and returns home', async () => {
    render(<MemoryRouter><PublicHomepageRoutes /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Enter the Platform' }));
    expect(await screen.findByText('Canonical route: /app')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Homepage' }));
    expect(await screen.findByRole('link', { name: 'Enter the Platform' })).toBeTruthy();
    expect(screen.queryByText('Canonical route: /app')).toBeNull();
  });

  it('delegates private and unknown destinations to the canonical shell', async () => {
    for (const pathname of ['/approvals', '/security/secrets', '/missing-route']) {
      const view = render(<MemoryRouter initialEntries={[pathname]}><PublicHomepageRoutes /></MemoryRouter>);
      expect(await screen.findByText(`Canonical route: ${pathname}`)).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Enter the Platform' })).toBeNull();
      view.unmount();
    }
  });
});
