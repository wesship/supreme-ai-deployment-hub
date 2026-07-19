import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomepageShell from '../HomepageShell';

vi.mock('@/components/Footer', () => ({ default: () => <footer>Enterprise Footer</footer> }));

it('renders homepage content and footer without duplicating application chrome', () => {
  render(
    <MemoryRouter>
      <HomepageShell>
        <section>Homepage content</section>
      </HomepageShell>
    </MemoryRouter>
  );

  expect(screen.getByText('Enterprise Footer')).toBeInTheDocument();
  expect(screen.getByText('Homepage content')).toBeInTheDocument();
  expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  expect(screen.queryByRole('main')).not.toBeInTheDocument();
  expect(screen.queryByText('Skip to main content')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
});
