import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { PublicFilmRoutes } from './PublicFilmApp';

const { canonicalRender } = vi.hoisted(() => ({ canonicalRender: vi.fn() }));
vi.mock('./pages/AIFilms', () => ({ default: () => <Link to="/occ">Operator access</Link> }));
vi.mock('./components/ScrollToTop', () => ({ default: () => null }));
vi.mock('./components/SkipToContent', () => ({ default: () => null }));
vi.mock('./components/shell/SignalAtmosphere', () => ({ default: () => null }));
vi.mock('./lib/mountPageVoiceReader', () => ({ mountPageVoiceReader: vi.fn() }));
vi.mock('./components/Navbar', () => ({ default: () => null }));
vi.mock('./components/ai/FloatingChatWidget', () => ({ FloatingChatWidget: () => null }));
vi.mock('./components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('./App', () => ({ CanonicalAppShell: () => {
  canonicalRender();
  const { pathname } = useLocation();
  return <><p>Canonical route: {pathname}</p><Link to="/film">Films</Link></>;
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Public Film entry', () => {
  it.each(['/film', '/film/', '/ai-films', '/ai-films/'])('renders canonical Film presentation on %s', (route) => {
      render(<MemoryRouter initialEntries={[route]}><PublicFilmRoutes /></MemoryRouter>);
      expect(screen.getByRole('link', { name: 'Operator access' })).toBeTruthy();
      expect(screen.getByRole('main').id).toBe('main-content');
      expect(canonicalRender).not.toHaveBeenCalled();
  });

  it('hands private navigation to canonical routing and returns to Film', async () => {
    render(<MemoryRouter initialEntries={['/film']}><PublicFilmRoutes /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Operator access' }));
    expect(await screen.findByText('Canonical route: /occ')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Films' }));
    expect(await screen.findByRole('link', { name: 'Operator access' })).toBeTruthy();
    expect(screen.queryByText('Canonical route: /occ')).toBeNull();
  });

  it('delegates unknown and private direct paths to canonical routing', async () => {
    for (const route of ['/film/private', '/approvals', '/missing-route']) {
      const view = render(<MemoryRouter initialEntries={[route]}><PublicFilmRoutes /></MemoryRouter>);
      expect(await screen.findByText(`Canonical route: ${route}`)).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Operator access' })).toBeNull();
      view.unmount();
    }
  });
});
