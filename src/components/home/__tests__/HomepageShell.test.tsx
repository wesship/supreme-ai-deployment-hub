import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomepageShell from '../HomepageShell';

vi.mock('@/components/Navbar', () => ({ default: () => <header>Enterprise Header</header> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer>Enterprise Footer</footer> }));

it('provides the canonical public shell without homepage breadcrumbs', () => {
  render(
    <MemoryRouter>
      <HomepageShell>
        <section>Homepage content</section>
      </HomepageShell>
    </MemoryRouter>
  );

  expect(screen.getByText('Enterprise Header')).toBeInTheDocument();
  expect(screen.getByText('Enterprise Footer')).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveTextContent('Homepage content');
  expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#main-content');
  expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
});
