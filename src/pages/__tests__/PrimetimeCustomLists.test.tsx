import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  listCustomLists: vi.fn(),
  createCustomList: vi.fn(),
  updateCustomList: vi.fn(),
  archiveCustomList: vi.fn(),
}));

vi.mock('@/lib/primetimeRelease1Api', () => ({
  primetimeRelease1Api: api,
}));

import PrimetimeCustomLists from '../PrimetimeCustomLists';

const activeList = {
  id: '11111111-1111-4111-8111-111111111111',
  workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  display_name: 'Annual Review Queue',
  description: 'Clients due for an annual protection review.',
  record_count: 7,
  created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  updated_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  created_at: '2026-07-25T12:00:00Z',
  updated_at: '2026-07-25T12:00:00Z',
  archived_at: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/primetime/custom-lists']}>
      <PrimetimeCustomLists />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listWorkspaces.mockResolvedValue([
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'D3VONN Main Workspace' },
  ]);
  api.listCustomLists.mockResolvedValue([activeList]);
  api.createCustomList.mockResolvedValue(activeList);
  api.updateCustomList.mockResolvedValue({ ...activeList, display_name: 'Priority Review Queue' });
  api.archiveCustomList.mockResolvedValue({ ...activeList, archived_at: '2026-07-25T13:00:00Z' });
});

describe('PRIMETIME governed Custom Lists', () => {
  it('loads the authenticated workspace and governed list inventory', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: /governed custom lists/i })).toBeInTheDocument();
    expect(await screen.findByText('Annual Review Queue')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(api.listCustomLists).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
  });

  it('filters lists locally without bypassing the governed API', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');

    fireEvent.change(screen.getByPlaceholderText(/search custom lists/i), {
      target: { value: 'missing' },
    });

    expect(screen.queryByText('Annual Review Queue')).not.toBeInTheDocument();
    expect(screen.getByText(/no custom lists found/i)).toBeInTheDocument();
  });

  it('creates a list through the authenticated API client', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');

    fireEvent.click(screen.getByRole('button', { name: /create custom list/i }));
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Hot Leads' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'High-priority follow-up.' } });
    fireEvent.click(screen.getByRole('button', { name: /^create list$/i }));

    await waitFor(() => expect(api.createCustomList).toHaveBeenCalledWith({
      workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      display_name: 'Hot Leads',
      description: 'High-priority follow-up.',
    }));
    expect(api.listCustomLists).toHaveBeenCalledTimes(2);
  });

  it('updates a list and preserves workspace scope', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');

    fireEvent.click(screen.getByRole('button', { name: /edit annual review queue/i }));
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Priority Review Queue' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(api.updateCustomList).toHaveBeenCalledWith(
      activeList.id,
      activeList.workspace_id,
      {
        display_name: 'Priority Review Queue',
        description: activeList.description,
      },
    ));
  });

  it('soft-archives a list through the role-governed endpoint', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');

    fireEvent.click(screen.getByRole('button', { name: /archive annual review queue/i }));
    expect(screen.getByText(/people records and audit history will remain intact/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^archive list$/i }));

    await waitFor(() => expect(api.archiveCustomList).toHaveBeenCalledWith(activeList.id, activeList.workspace_id));
    expect(api.listCustomLists).toHaveBeenCalledTimes(2);
  });

  it('requests archived records only when the user enables the governed filter', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');

    fireEvent.click(screen.getByRole('checkbox', { name: /include archived/i }));

    await waitFor(() => expect(api.listCustomLists).toHaveBeenLastCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      true,
    ));
  });
});
