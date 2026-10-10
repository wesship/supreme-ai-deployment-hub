import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HomepageCTAGroup from '../HomepageCTAGroup';

vi.mock('@/components/SmartLaunchLink', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/app" className={className}>{children}</a>
  ),
}));

describe('HomepageCTAGroup', () => {
  it('renders the canonical launch and exploration actions', () => {
    render(
      <MemoryRouter>
        <HomepageCTAGroup />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /enter d3vonn\.io/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /explore the platform/i })).toHaveAttribute('href', '/solutions');
  });

  it('supports page-specific secondary destinations without changing CTA hierarchy', () => {
    render(
      <MemoryRouter>
        <HomepageCTAGroup secondaryLabel="Review security" secondaryTo="/security" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /review security/i })).toHaveAttribute('href', '/security');
  });
});
