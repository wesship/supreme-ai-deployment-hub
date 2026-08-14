import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const releaseApi = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  getDailyDashboard: vi.fn(),
  listPeople: vi.fn(),
}));

const customApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  listMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock('@/lib/primetimeRelease1Api', () => ({
  primetimeRelease1Api: releaseApi,
}));

vi.mock('@/lib/primetimeCustomListsApi', () => ({
  primetimeCustomListsApi: customApi,
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
  removed_by: null,
  removed_at: null,
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
  releaseApi.listWorkspaces.mockResolvedValue([{ id: workspaceId, name: 'D3VONN Main Workspace' }]);
  releaseApi.getDailyDashboard.mockResolvedValue({
    workspaceId,
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    role: 'manager',
    openLeads: [],
    openTasks: [],
    exceptions: [],
    summary: { openLeadCount: 0, openTaskCount: 0, exceptionCount: 0 },
  });
  releaseApi.listPeople.mockResolvedValue([personOne, personTwo]);
  customApi.list.mockResolvedValue([activeList]);
  customApi.create.mockResolvedValue(activeList);
  customApi.update.mockResolvedValue({ ...activeList, display_name: 'Priority Review Queue' });
  customApi.archive.mockResolvedValue({ ...activeList, archived_at: '2026-07-25T13:00:00Z' });
  customApi.listMembers.mockResolvedValue([memberOne]);
  customApi.addMember.mockResolvedValue({ ...memberOne, id: '55555555-5555-4555-8555-555555555555', person_id: personTwo.id });
  customApi.removeMember.mockResolvedValue({ ...memberOne, removed_at: '2026-07-25T14:00:00Z' });
});

describe('PRIMETIME governed Custom Lists', () => {
  it('loads the authenticated workspace and governed list inventory', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /governed custom lists/i })).toBeInTheDocument();
    expect(await screen.findByText('Annual Review Queue')).toBeInTheDocument();
    const listRow = screen.getByText('Annual Review Queue').closest('tr');
    expect(listRow).not.toBeNull();
    expect(within(listRow as HTMLElement).getByText('7')).toBeInTheDocument();
    expect(customApi.list).toHaveBeenCalledWith(workspaceId, false);
  });

  it('filters lists locally without bypassing the governed API', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.change(screen.getByPlaceholderText(/search custom lists/i), { target: { value: 'missing' } });
    expect(screen.queryByText('Annual Review Queue')).not.toBeInTheDocument();
    expect(screen.getByText(/no custom lists found/i)).toBeInTheDocument();
  });

  it('creates a list through the authenticated custom-lists client', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /create custom list/i }));
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Hot Leads' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'High-priority follow-up.' } });
    fireEvent.click(screen.getByRole('button', { name: /^create list$/i }));
    await waitFor(() => expect(customApi.create).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      display_name: 'Hot Leads',
      description: 'High-priority follow-up.',
    }));
    expect(customApi.list).toHaveBeenCalledTimes(2);
  });

  it('updates a list while preserving workspace scope', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /edit annual review queue/i }));
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Priority Review Queue' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(customApi.update).toHaveBeenCalledWith(activeList.id, {
      workspace_id: workspaceId,
      display_name: 'Priority Review Queue',
      description: activeList.description,
    }));
  });

  it('soft-archives a list only for a manager-capable session', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /archive annual review queue/i }));
    expect(screen.getByText(/people records and audit history will remain intact/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^archive list$/i }));
    await waitFor(() => expect(customApi.archive).toHaveBeenCalledWith(activeList.id, workspaceId));
    expect(customApi.list).toHaveBeenCalledTimes(2);
  });

  it('disables archive for representative role while backend remains authoritative', async () => {
    releaseApi.getDailyDashboard.mockResolvedValue({
      workspaceId,
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      role: 'representative',
      openLeads: [], openTasks: [], exceptions: [],
      summary: { openLeadCount: 0, openTaskCount: 0, exceptionCount: 0 },
    });
    renderPage();
    await screen.findByText('Annual Review Queue');
    expect(screen.getByRole('button', { name: /archive annual review queue/i })).toBeDisabled();
  });

  it('requests archived records only when the governed filter is enabled', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('checkbox', { name: /include archived/i }));
    await waitFor(() => expect(customApi.list).toHaveBeenLastCalledWith(workspaceId, true));
  });

  it('loads active members and resolves workspace person names', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /manage members for annual review queue/i }));
    expect(await screen.findByText('Lisa Smith')).toBeInTheDocument();
    expect(screen.getByText('lisa@example.com')).toBeInTheDocument();
    expect(customApi.listMembers).toHaveBeenCalledWith(activeList.id, workspaceId);
    expect(releaseApi.listPeople).toHaveBeenCalledWith(workspaceId);
  });

  it('adds an eligible workspace person and refreshes members and counts', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /manage members for annual review queue/i }));
    await screen.findByText('Marcus Jones');
    fireEvent.click(screen.getByRole('button', { name: /add marcus jones/i }));
    await waitFor(() => expect(customApi.addMember).toHaveBeenCalledWith(activeList.id, workspaceId, personTwo.id));
    expect(customApi.listMembers).toHaveBeenCalledTimes(2);
    expect(customApi.list).toHaveBeenCalledTimes(2);
  });

  it('soft-removes an active member and refreshes governed data', async () => {
    renderPage();
    await screen.findByText('Annual Review Queue');
    fireEvent.click(screen.getByRole('button', { name: /manage members for annual review queue/i }));
    await screen.findByText('Lisa Smith');
    fireEvent.click(screen.getByRole('button', { name: /remove lisa smith/i }));
    await waitFor(() => expect(customApi.removeMember).toHaveBeenCalledWith(activeList.id, personOne.id, workspaceId));
    expect(customApi.listMembers).toHaveBeenCalledTimes(2);
    expect(customApi.list).toHaveBeenCalledTimes(2);
  });
});
