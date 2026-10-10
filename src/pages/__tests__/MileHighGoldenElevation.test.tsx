import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import MileHighGoldenElevation from '../MileHighGoldenElevation';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/mile-high-golden-elevation']}>
        <MileHighGoldenElevation />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('Mile High Golden Elevation relaunch', () => {
  it('preserves the Denver, founder, ethical craft, and circular-development facts', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /jewelry with a higher standard/i })).toBeInTheDocument();
    expect(screen.getByText(/founded by Wesley K\. Little/i)).toBeInTheDocument();
    expect(screen.getByText(/responsibly sourced precious metals are a core brand standard/i)).toBeInTheDocument();
    expect(screen.getByText(/initiative remains in development/i)).toBeInTheDocument();
  });

  it('routes every sales action into the governed jewelry inquiry preset', () => {
    renderPage();

    const consultationLinks = screen.getAllByRole('link', { name: /consultation|engagement|fine jewelry|custom/i });
    expect(consultationLinks.length).toBeGreaterThanOrEqual(4);
    consultationLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/contact?inquiry=mile-high-golden-elevation');
    });
  });

  it('states that commerce and supplier data are not live', () => {
    renderPage();

    expect(screen.getByText('Not yet published')).toBeInTheDocument();
    expect(screen.getByText('Not yet enabled')).toBeInTheDocument();
    expect(screen.getByText(/Nivoda connectivity is integration-ready but not live/i)).toBeInTheDocument();
    expect(screen.getByText(/no supplier inventory, price, certificate, reservation, or fulfillment promise/i)).toBeInTheDocument();
  });
});
