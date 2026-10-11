import React, { useEffect } from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeferredProviders from './DeferredProviders';

afterEach(cleanup);
describe('Public presentation lifecycle', () => {
  it.each(['/', '/film', '/film/', '/ai-films'])('keeps %s mounted without scheduling workspace providers', (path) => {
    const schedule = vi.fn();
    vi.stubGlobal('requestIdleCallback', schedule);
    const mounted = vi.fn();
    const unmounted = vi.fn();
    function Hero() {
      useEffect(() => { mounted(); return unmounted; }, []);
      return <h1>Public hero</h1>;
    }
    const { rerender } = render(<MemoryRouter initialEntries={[path]}><DeferredProviders><Hero /></DeferredProviders></MemoryRouter>);
    rerender(<MemoryRouter initialEntries={[path]}><DeferredProviders><Hero /></DeferredProviders></MemoryRouter>);
    expect(schedule).not.toHaveBeenCalled();
    expect(mounted).toHaveBeenCalledOnce();
    expect(unmounted).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
