import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CustomLists from '../CustomLists';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/crm/lists']}>
      <CustomLists />
    </MemoryRouter>,
  );
}

describe('PRIMETIME CRM Custom Lists', () => {
  it('renders the seeded custom-list inventory', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /custom lists/i })).toBeInTheDocument();
    expect(screen.getByText('Future Transactions')).toBeInTheDocument();
    expect(screen.getByText('Hot List')).toBeInTheDocument();
    expect(screen.getByText('90 Day Challenge Omar Script')).toBeInTheDocument();
    expect(screen.getByText(/showing 13 of 13 lists/i)).toBeInTheDocument();
  });

  it('filters lists by display name and description', () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/search custom lists/i), {
      target: { value: 'retention' },
    });

    expect(screen.getByText('Proactive Retention Pilot')).toBeInTheDocument();
    expect(screen.queryByText('Hot List')).not.toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 13 lists/i)).toBeInTheDocument();
  });

  it('reverses display-name sorting', () => {
    renderPage();

    const table = screen.getByRole('table');
    const firstDataRowBefore = within(table).getAllByRole('row')[1];
    expect(within(firstDataRowBefore).getByText('90 Day Challenge Call Script')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /display name/i }));

    const firstDataRowAfter = within(table).getAllByRole('row')[1];
    expect(within(firstDataRowAfter).getByText('Wall of Wealth Landing Page Leads')).toBeInTheDocument();
  });

  it('supports individual and bulk row selection', () => {
    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: /select hot list/i }));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /select all lists/i }));
    expect(screen.getByText(/13 selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });
});
