import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
    renderHome();
    expect(screen.getByText('Enter D3VONN.IO').closest('a')).toHaveAttribute('href', '/app');
    expect(screen.getByText('Launch D3VONN').closest('a')).toHaveAttribute('href', '/app');
    expect(screen.getByText(/operator access.*admin sign-in required/i).closest('a')).toHaveAttribute('href', '/occ');
    expect(screen.getByText('Open Voice Studio').closest('a')).toHaveAttribute('href', '/voice-studio');
    expect(screen.getByText('Enter AI Films').closest('a')).toHaveAttribute('href', '/film');
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
  });

  it('labels illustrative consoles and does not imitate microphone interaction', () => {
    renderHome();
    expect(screen.getByText('Illustrative interface — not live runtime data')).toBeInTheDocument();
    expect(screen.getByText(/does not access your microphone or simulate a conversation/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /speak|microphone|record/i })).not.toBeInTheDocument();
  });

  it('uses accurate cumulative metric labels and explicit unknown fallback values', () => {
    renderHome();
    expect(screen.getByText('Completed workflows')).toBeInTheDocument();
    expect(screen.getByText('Tasks processed')).toBeInTheDocument();
    expect(screen.queryByText('Workflows today')).not.toBeInTheDocument();
    expect(screen.queryByText('Knowledge nodes')).not.toBeInTheDocument();
    expect(screen.getAllByText('Not reported')).toHaveLength(3);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(normalizePublicStats(null)).toEqual(defaultHomepageTelemetry);
  });

  it('retains the public API field mapping without fabricating values for missing fields', () => {
    const normalized = normalizePublicStats({ active_agents: 7, completed_workflows: 29, total_tasks_processed: 101, system_health: 'healthy' });
    expect(normalized).toMatchObject({ activeAgents: '7', workflowsToday: '29', knowledgeNodes: '101', systemStatus: 'healthy', hermesQueue: 'Not reported' });
  });
});
