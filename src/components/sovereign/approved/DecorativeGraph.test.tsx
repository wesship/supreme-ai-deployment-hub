import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DecorativeGraph from './DecorativeGraph';
import { supportsGraphWebGL } from './graphWebGL';

vi.mock('./graphWebGL', () => ({ supportsGraphWebGL: vi.fn() }));
vi.mock('./ThreeBackground', () => ({ default: ({ compact }: { compact: boolean }) => <div data-testid="graph">{compact ? 'compact' : 'full'}</div> }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('Decorative graph loading', () => {
  it('keeps the static fallback when hardware rendering is unavailable', () => {
    vi.mocked(supportsGraphWebGL).mockReturnValue(false);
    render(<MemoryRouter><DecorativeGraph /></MemoryRouter>);
    expect(screen.queryByTestId('graph')).toBeNull();
  });
  it('does not probe or load the hidden Film graph', () => {
    vi.mocked(supportsGraphWebGL).mockReturnValue(true);
    render(<MemoryRouter initialEntries={['/film/']}><DecorativeGraph compact /></MemoryRouter>);
    expect(supportsGraphWebGL).not.toHaveBeenCalled();
    expect(screen.queryByTestId('graph')).toBeNull();
  });
  it('preserves the graph on supported hardware', async () => {
    vi.mocked(supportsGraphWebGL).mockReturnValue(true);
    render(<MemoryRouter><DecorativeGraph compact /></MemoryRouter>);
    expect((await screen.findByTestId('graph')).textContent).toBe('compact');
  });
});
