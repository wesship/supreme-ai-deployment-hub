import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignalAtmosphere from './SignalAtmosphere';

const { sceneRender } = vi.hoisted(() => ({ sceneRender: vi.fn() }));
vi.mock('./SignalGraphScene', () => ({ default: () => { sceneRender(); return <span>Graph scene</span>; } }));
vi.mock('@/components/sovereign/approved/ReduceMotionToggle', () => ({ default: () => <button>Reduce motion</button> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('keeps Film aliases on the static backdrop without mounting the graph scene', () => {
  for (const route of ['/film', '/film/', '/ai-films', '/ai-films/']) {
    const view = render(<MemoryRouter initialEntries={[route]}><SignalAtmosphere /></MemoryRouter>);
    expect(view.container.querySelector('.d3-signal-network')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reduce motion' })).toBeTruthy();
    expect(sceneRender).not.toHaveBeenCalled();
    view.unmount();
  }
});

it('retains the graph scene on other public pages', async () => {
  render(<MemoryRouter initialEntries={['/pricing']}><SignalAtmosphere /></MemoryRouter>);
  expect(await screen.findByText('Graph scene')).toBeTruthy();
});
