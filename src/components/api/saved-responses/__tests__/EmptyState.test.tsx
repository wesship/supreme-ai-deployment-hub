
import React from 'react';
import { render, screen } from '@testing-library/react';
import EmptyState from '../EmptyState';

describe('EmptyState component', () => {
  it('renders the empty state message correctly', () => {
    render(<EmptyState />);
    
    expect(screen.getByText('No saved responses yet')).toBeInTheDocument();
    expect(
      screen.getByText('Use the API Playground to test endpoints and save responses for future reference')
    ).toBeInTheDocument();
  });

  it('renders within a CardContent component', () => {
    const { container } = render(<EmptyState />);
    // CardContent renders a div with padding classes (e.g., pt-4, p-6)
    const cardContent = container.firstElementChild;
    expect(cardContent).toBeInTheDocument();
  });

  it('has proper styling for empty state', () => {
    const { container } = render(<EmptyState />);
    // The inner div with flex styling is inside CardContent wrapper
    const emptyStateDiv = container.querySelector('.flex.flex-col');
    
    expect(emptyStateDiv).toHaveClass('flex');
    expect(emptyStateDiv).toHaveClass('flex-col');
    expect(emptyStateDiv).toHaveClass('items-center');
    expect(emptyStateDiv).toHaveClass('justify-center');
    expect(emptyStateDiv).toHaveClass('text-center');
  });
});
