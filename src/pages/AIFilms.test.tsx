import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AIFilms from './AIFilms';

vi.mock('@/components/shell/PublicPageShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/lib/featureFlags', () => ({ useFeatureFlag: () => false }));

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Public film preview progress', () => {
  it('does not record viewing progress just from opening a preview', () => {
    render(<AIFilms />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch Preview', exact: true }));
    expect(JSON.parse(window.localStorage.getItem('d3vonn-ai-films-library-v1')!).progress).toEqual({});
    expect(screen.queryByRole('button', { name: 'Track Preview Progress' })).toBeNull();
    expect(screen.getByText(/Full productions are not available/)).toBeTruthy();
  });

  it('records progress from finite playback duration and completes when the clip ends', () => {
    const { container } = render(<AIFilms />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch Preview', exact: true }));
    const video = container.querySelector<HTMLVideoElement>('video[aria-label="Sovereign Signal preview"]')!;
    Object.defineProperty(video, 'duration', { configurable: true, value: Number.NaN });
    fireEvent.timeUpdate(video);
    expect(JSON.parse(window.localStorage.getItem('d3vonn-ai-films-library-v1')!).progress).toEqual({});
    Object.defineProperty(video, 'duration', { configurable: true, value: 4 });
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 2 });
    fireEvent.timeUpdate(video);
    expect(JSON.parse(window.localStorage.getItem('d3vonn-ai-films-library-v1')!).progress['sovereign-signal']).toBe(50);
    fireEvent.ended(video);
    expect(JSON.parse(window.localStorage.getItem('d3vonn-ai-films-library-v1')!).progress['sovereign-signal']).toBe(100);
  });
});
