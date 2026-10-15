import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { defaultHomepageTelemetry } from '@/lib/homepageTelemetry';
import SovereignSignalHomepage from './SovereignSignalHomepage';

vi.mock('./approved/ThreeBackground', () => ({ default: () => null }));
vi.mock('./approved/Reveal', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
afterEach(cleanup);

describe('Approved responsive homepage handoff', () => {
  it('opens the mobile navigation and closes it on Escape with focus restored', () => {
    render(<MemoryRouter><SovereignSignalHomepage telemetry={defaultHomepageTelemetry} /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps studio destinations accessible in a keyboard-dismissable disclosure', () => {
    render(<MemoryRouter><SovereignSignalHomepage telemetry={defaultHomepageTelemetry} /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    const studios = within(nav).getByRole('button', { name: 'Studios' });
    expect(studios).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(studios);
    expect(within(nav).getByRole('link', { name: 'AI Films' })).toHaveAttribute('href', '/ai-films');
    expect(within(nav).getByRole('link', { name: 'Music Studio' })).toHaveAttribute('href', '/music');
    expect(within(nav).getByRole('link', { name: 'Voice Studio' })).toHaveAttribute('href', '/voice-studio');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(studios).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(studios);
    expect(within(nav).queryByRole('link', { name: 'Music Studio' })).toBeNull();
  });

  it('closes a desktop disclosure when another group opens or the user clicks outside', () => {
    render(<MemoryRouter><SovereignSignalHomepage telemetry={defaultHomepageTelemetry} /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    const studios = within(nav).getByRole('button', { name: 'Studios' });
    const resources = within(nav).getByRole('button', { name: 'Resources' });
    fireEvent.click(studios);
    fireEvent.click(resources);
    expect(studios).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).getByRole('link', { name: 'Command Core' })).toHaveAttribute('href', '/command-center');
    fireEvent.pointerDown(document.body);
    expect(resources).toHaveAttribute('aria-expanded', 'false');
  });

  it('moves keyboard focus to the selected section when mobile navigation closes', () => {
    const scrollIntoView = vi.fn();
    const { container } = render(<MemoryRouter><SovereignSignalHomepage telemetry={defaultHomepageTelemetry} /></MemoryRouter>);
    const platform = container.querySelector<HTMLElement>('#platform')!;
    platform.scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole('link', { name: 'Platform' }));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(platform);
  });

  it('hands voice input to the canonical Voice Studio rather than simulating a response', () => {
    render(<MemoryRouter><Routes>
      <Route path="/" element={<SovereignSignalHomepage telemetry={defaultHomepageTelemetry} />} />
      <Route path="/voice-studio" element={<p>Canonical voice route</p>} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));
    expect(screen.getByText('Canonical voice route')).toBeTruthy();
  });

  it('preserves the approved artwork, section order, platform handoff, and honest system status', () => {
    const { container } = render(<MemoryRouter><SovereignSignalHomepage telemetry={defaultHomepageTelemetry} /></MemoryRouter>);
    expect(container.querySelector('#top img[alt="D3VONN"]')?.getAttribute('src')).toBe('/approved-home/emblem.webp');
    expect(container.querySelector('#platform')).toBeTruthy();
    expect(container.querySelector('#top a[href="/app"]')).toBeTruthy();
    expect(container.textContent).not.toContain('All systems operational');
    expect(container.textContent).toContain('Status unavailable — view checks');
    expect(container.querySelector('a[href="/status"]')).toBeTruthy();
    expect(container.textContent).toContain('Illustrative // Simulated');
  });
});
