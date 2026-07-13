import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomepageShell from '../HomepageShell';

vi.mock('@/components/Navbar', () => ({ default: () => <header>Enterprise Header</header> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer>Enterprise Footer</footer> }));

it('provides public chrome without duplicating the application main landmark', () => {
  render(
    <MemoryRouter>
      <HomepageShell>
        <section>Homepage content</section>
      </HomepageShell>
    </MemoryRouter>
  );

  expect(screen.getByText('Enterprise Header')).toBeInTheDocument();
  expect(screen.getByText('Enterprise Footer')).toBeInTheDocument();
  expect(screen.getByText('Homepage content')).toBeInTheDocument();
  expect(screen.queryByRole('main')).not.toBeInTheDocument();
  expect(screen.queryByText('Skip to main content')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
});
