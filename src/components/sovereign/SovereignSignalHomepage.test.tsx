import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { defaultHomepageTelemetry } from '@/lib/homepageTelemetry';
import SovereignSignalHomepage from './SovereignSignalHomepage';

vi.mock('./SovereignNeuralWeb', () => ({ default: () => null }));
afterEach(cleanup);

describe('Sovereign Signal homepage handoff', () => {
  it('opens the mobile navigation and closes it on Escape with focus restored', () => {
    render(<MemoryRouter><SovereignSignalHomepage telemetry={defaultHomepageTelemetry} /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('navigation', { name: 'Primary navigation' }).className).toContain('sovereign-nav-open');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('hands the launch link to the canonical app route', () => {
    render(<MemoryRouter><Routes>
      <Route path="/" element={<SovereignSignalHomepage telemetry={defaultHomepageTelemetry} />} />
      <Route path="/app" element={<p>Canonical app route</p>} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    fireEvent.click(within(nav).getByRole('link', { name: 'ENTER SYSTEM' }));
    expect(screen.getByText('Canonical app route')).toBeTruthy();
  });

  it('shows missing telemetry honestly rather than fabricated counts or readiness', () => {
    const { container } = render(<MemoryRouter><SovereignSignalHomepage telemetry={defaultHomepageTelemetry} /></MemoryRouter>);
    expect(container.textContent).not.toContain('12,843');
    expect(container.textContent).not.toContain('2,465+');
    expect(container.textContent).not.toContain('CORE ONLINE');
    expect(container.querySelector('.sovereign-telemetry strong')?.textContent).toBe('Not reported');
    expect(container.querySelector('.readdy-command-artwork')?.getAttribute('src')).toBe('/d3vonn-enterprise-core.webp');
    expect(container.querySelector('#platform')).toBeTruthy();
  });
});
