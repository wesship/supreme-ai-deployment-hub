import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  listCustomLists: vi.fn(),
  createCustomList: vi.fn(),
  updateCustomList: vi.fn(),
  archiveCustomList: vi.fn(),
  listCustomListMembers: vi.fn(),
  addCustomListMember: vi.fn(),
  removeCustomListMember: vi.fn(),
  listPeople: vi.fn(),
}));

vi.mock('@/lib/primetimeRelease1Api', () => ({
  primetimeRelease1Api: api,
}));

import PrimetimeCustomLists from '../PrimetimeCustomLists';

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const activeList = {
  id: '11111111-1111-4111-8111-111111111111',
  workspace_id: workspaceId,
  display_name: 'Annual Review Queue',
  description: 'Clients due for an annual protection review.',
  record_count: 7,
  created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  updated_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  created_at: '2026-07-25T12:00:00Z',
  updated_at: '2026-07-25T12:00:00Z',
  archived_at: null,
};
const personOne = {
  id: '22222222-2222-4222-8222-222222222222',
  first_name: 'Lisa',
  last_name: 'Smith',
  email: 'lisa@example.com',
};
const personTwo = {
  id: '33333333-3333-4333-8333-333333333333',
  first_name: 'Marcus',
  last_name: 'Jones',
  email: 'marcus@example.com',
};
const memberOne = {
  id: '44444444-4444-4444-8444-444444444444',
  workspace_id: workspaceId,
  custom_list_id: activeList.id,
  person_id: personOne.id,
  added_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  added_at: '2026-07-25T12:30:00Z',
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
  api.listWorkspaces.mockResolvedValue([{ id: workspaceId, name: 'D3VONN Main Workspace' }]);
  api.listCustomLists.mockResolvedValue([activeList]);
  api.createCustomList.mockResolvedValue(activeList);
  api.updateCustomList.mockResolvedValue({ ...activeList, display_name: 'Priority Review Queue' });
  api.archiveCustomList.mockResolvedValue({ ...activeList, archived_at: '2026-07-25T13:00:00Z' });
  api.listCustomListMembers.mockResolvedValue([memberOne]);
  api.listPeople.mockResolvedValue([personOne, personTwo]);
  api.addCustomListMember.mockResolvedValue({ ...memberOne, id: '55555555-5555-4555-8555-555555555555', person_id: personTwo.id });
  api.removeCustomListMember.mockResolvedValue({ ...memberOne, removed_at: '2026-07-25T14:00:00Z' });
});

describe('PRIMETIME governed Custom Lists', () => {
  it('loads the authenticated workspace and governed list inventory', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /governed custom lists/i })).toBeInTheDocument();
    expect(await screen.findByText('Annual Review Queue')).toBeInTheDocument();
    const listRow = screen.getByText('Annual Review Queue').closest('tr');
    expect(listRow).not.toBeNull();
    expect(within(listRow as HTMLElement).getByText('7')).toBeInTheDocument();
    expect(api.listCustomLists).toHaveBeenCalledWith(workspaceId, false);
  });

  it('filters lists locally without bypassing the governed API', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.change(screen.getByPlaceholderText(/search custom lists/i), { target: { value: 'missing' } });
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
      workspace_id: workspaceId,
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
    await waitFor(() => expect(api.updateCustomList).toHaveBeenCalledWith(activeList.id, workspaceId, {
      display_name: 'Priority Review Queue',
      description: activeList.description,
    }));
  });

  it('soft-archives a list through the role-governed endpoint', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /archive annual review queue/i }));
    expect(screen.getByText(/people records and audit history will remain intact/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^archive list$/i }));
    await waitFor(() => expect(api.archiveCustomList).toHaveBeenCalledWith(activeList.id, workspaceId));
    expect(api.listCustomLists).toHaveBeenCalledTimes(2);
  });

  it('requests archived records only when the user enables the governed filter', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('checkbox', { name: /include archived/i }));
    await waitFor(() => expect(api.listCustomLists).toHaveBeenLastCalledWith(workspaceId, true));
  });

  it('loads active members and resolves their workspace person names', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /manage members for annual review queue/i }));
    expect(await screen.findByText('Lisa Smith')).toBeInTheDocument();
    expect(screen.getByText('lisa@example.com')).toBeInTheDocument();
    expect(api.listCustomListMembers).toHaveBeenCalledWith(activeList.id, workspaceId);
    expect(api.listPeople).toHaveBeenCalledWith(workspaceId);
  });

  it('adds an eligible workspace person and refreshes members and list counts', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /manage members for annual review queue/i }));
    await screen.findByText('Marcus Jones');
    fireEvent.click(screen.getByRole('button', { name: /add marcus jones/i }));
    await waitFor(() => expect(api.addCustomListMember).toHaveBeenCalledWith(activeList.id, workspaceId, personTwo.id));
    expect(api.listCustomListMembers).toHaveBeenCalledTimes(2);
    expect(api.listCustomLists).toHaveBeenCalledTimes(2);
  });

  it('soft-removes an active member and refreshes governed data', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /manage members for annual review queue/i }));
    await screen.findByText('Lisa Smith');
    fireEvent.click(screen.getByRole('button', { name: /remove lisa smith/i }));
    await waitFor(() => expect(api.removeCustomListMember).toHaveBeenCalledWith(activeList.id, personOne.id, workspaceId));
    expect(api.listCustomListMembers).toHaveBeenCalledTimes(2);
    expect(api.listCustomLists).toHaveBeenCalledTimes(2);
  });
});
