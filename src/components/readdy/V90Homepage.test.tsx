import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultHomepageTelemetry, normalizePublicStats } from '@/lib/homepageTelemetry';
import V90Homepage from './V90Homepage';

vi.mock('@/components/SmartLaunchLink', () => ({
  default: ({ children, authedTo, className }: { children: React.ReactNode; authedTo: string; className?: string }) => (
    <a href={authedTo} className={className}>{children}</a>
  ),
}));

afterEach(cleanup);

const renderHome = () => render(
  <MemoryRouter><V90Homepage telemetry={defaultHomepageTelemetry} /></MemoryRouter>,
);

describe('Readdy V90 homepage presentation boundary', () => {
  it('renders the authentic section composition with one accessible primary heading', () => {
    const { container } = renderHome();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')).toHaveTextContent('INTELLIGENCE UNDER YOUR COMMAND.');
    const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent);
    for (const title of ['One Signal. Multiple Systems.', 'Intelligence Built to Act.', 'Stories Generated at the Speed of Imagination.', 'Own the Intelligence Layer.', 'Speak to the System.', 'Technology Should Expand Human Ability.', 'THE SIGNAL IS YOURS.']) {
      expect(headings).toContain(title);
    }
  });

  it('retains canonical launch and protected operational destinations', () => {
    const { container } = renderHome();
    // Traverse the dense decorative DOM once; avoid repeated global text queries.
    const destinations = new Map([...container.querySelectorAll('a')].map((link) => [
      link.textContent?.trim(), link.getAttribute('href'),
    ]));
    expect(destinations.get('Enter D3VONN.IO')).toBe('/app');
    expect(destinations.get('Launch D3VONN')).toBe('/app');
    expect(destinations.get('Operator access — admin sign-in required')).toBe('/occ');
    expect(destinations.get('Open Voice Studio')).toBe('/voice-studio');
    expect(destinations.get('Enter AI Films')).toBe('/film');
  });

  it('only embeds local images with stable intrinsic dimensions', () => {
    const { container } = renderHome();
    const images = [...container.querySelectorAll('img')];
    expect(images).toHaveLength(10);
    for (const image of images) {
      expect(image.getAttribute('src')).toMatch(/^\/readdy-v90\//);
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
    }
    expect(container.querySelector('iframe, script, form, input')).toBeNull();
    expect(container.querySelector('.rv-film-strip')).toHaveAttribute('tabindex', '0');
    expect(container.querySelector('.rv-film-strip')).toHaveAttribute('role', 'region');
  });

  it('labels illustrative consoles and does not imitate microphone interaction', () => {
    const { container } = renderHome();
    const copy = container.textContent ?? '';
    expect(copy).toContain('Illustrative interface — not live runtime data');
    expect(copy).toContain('does not access your microphone or simulate a conversation');
    expect(container.querySelector('button')).toBeNull();
  });

  it('uses accurate cumulative metric labels and explicit unknown fallback values', () => {
    const { container } = renderHome();
    const telemetry = container.querySelector('.rv-hero__telemetry');
    const copy = telemetry?.textContent ?? '';
    expect(copy).toContain('Completed workflows');
    expect(copy).toContain('Tasks processed');
    expect(copy).not.toContain('Workflows today');
    expect(copy).not.toContain('Knowledge nodes');
    expect([...telemetry!.querySelectorAll('strong')].map((value) => value.textContent)).toEqual([
      'Not reported', 'Not reported', 'Not reported', 'Unknown',
    ]);
    expect(normalizePublicStats(null)).toEqual(defaultHomepageTelemetry);
  });

  it('retains the public API field mapping without fabricating values for missing fields', () => {
    const normalized = normalizePublicStats({ active_agents: 7, completed_workflows: 29, total_tasks_processed: 101, system_health: 'healthy' });
    expect(normalized).toMatchObject({ activeAgents: '7', workflowsToday: '29', knowledgeNodes: '101', systemStatus: 'healthy', hermesQueue: 'Not reported' });
  });
});
