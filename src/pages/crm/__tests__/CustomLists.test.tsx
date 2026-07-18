import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

async function waitForSeedData() {
  await screen.findByText('Future Transactions');
}

describe('PRIMETIME CRM Custom Lists', () => {
  it('renders the seeded custom-list inventory', async () => {
    renderPage();
    await waitForSeedData();

    expect(screen.getByRole('heading', { name: /custom lists/i })).toBeInTheDocument();
    expect(screen.getByText('Hot List')).toBeInTheDocument();
    expect(screen.getByText('90 Day Challenge Omar Script')).toBeInTheDocument();
    expect(screen.getByText(/showing 13 of 13 lists/i)).toBeInTheDocument();
  });

  it('filters lists by display name and description', async () => {
    renderPage();
    await waitForSeedData();

    fireEvent.change(screen.getByPlaceholderText(/search custom lists/i), {
      target: { value: 'retention' },
    });

    expect(screen.getByText('Proactive Retention Pilot')).toBeInTheDocument();
    expect(screen.queryByText('Hot List')).not.toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 13 lists/i)).toBeInTheDocument();
  });

  it('reverses display-name sorting', async () => {
    renderPage();
    await waitForSeedData();

    const table = screen.getByRole('table');
    const firstDataRowBefore = within(table).getAllByRole('row')[1];
    expect(within(firstDataRowBefore).getByText('90 Day Challenge Call Script')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /display name/i }));

    const firstDataRowAfter = within(table).getAllByRole('row')[1];
    expect(within(firstDataRowAfter).getByText('Wall of Wealth Landing Page Leads')).toBeInTheDocument();
  });

  it('supports individual and bulk row selection', async () => {
    renderPage();
    await waitForSeedData();

    fireEvent.click(screen.getByRole('checkbox', { name: /select hot list/i }));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /select all lists/i }));
    expect(screen.getByText(/13 selected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
  });

  it('creates a custom list through the accessible editor dialog', async () => {
    renderPage();
    await waitForSeedData();

    fireEvent.click(screen.getByRole('button', { name: /create new custom list/i }));
    expect(screen.getByRole('dialog', { name: /create custom list/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Annual Review Queue' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Clients due for an annual protection review.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create list/i }));

    expect(await screen.findByText('Annual Review Queue')).toBeInTheDocument();
    expect(screen.getByText(/showing 14 of 14 lists/i)).toBeInTheDocument();
  });

  it('edits an existing list through the accessible editor dialog', async () => {
    renderPage();
    await waitForSeedData();

    fireEvent.click(screen.getByRole('button', { name: /edit hot list/i }));
    expect(screen.getByRole('dialog', { name: /edit custom list/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'Priority Follow-Up List' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Priority Follow-Up List')).toBeInTheDocument();
    expect(screen.queryByText('Hot List')).not.toBeInTheDocument();
  });

  it('archives a list without deleting contact records', async () => {
    renderPage();
    await waitForSeedData();

    fireEvent.click(screen.getByRole('button', { name: /archive hot list/i }));
    expect(screen.getByRole('alertdialog', { name: /archive custom list/i })).toBeInTheDocument();
    expect(screen.getByText(/contact records will not be deleted/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /archive list/i }));

    await waitFor(() => expect(screen.queryByText('Hot List')).not.toBeInTheDocument());
    expect(screen.getByText(/showing 12 of 12 lists/i)).toBeInTheDocument();
  });
});
