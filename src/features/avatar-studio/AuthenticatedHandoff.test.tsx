import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WorkflowMetadata } from './workflowImport';
const mocks = vi.hoisted(() => ({ session: vi.fn(), auth: null as null | ((event: string, session: { user: { id: string } } | null) => void), check: vi.fn(), projects: vi.fn(), save: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.session, onAuthStateChange: (callback: typeof mocks.auth) => { mocks.auth = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; } } } }));
vi.mock('./handoffService', () => ({ checkHandoff: mocks.check, ownedHandoffProjects: mocks.projects, saveHandoff: mocks.save }));
import AuthenticatedHandoff from './AuthenticatedHandoff';
const plan: WorkflowMetadata = { project: { id: 'local', title: 'Bulletin', format: 'news_anchor', aspectRatio: '16:9', captions: true, contentHash: 'local' }, generatedAt: '2026-10-04T00:00:00Z', overall: 'draft', stages: [], idempotencyKey: 'local-key' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'account-a' } } } });
  mocks.check.mockResolvedValue({ handoff_enabled: true });
  mocks.projects.mockResolvedValue({ items: [{ id: 'owned-project', title: 'Owned film' }], has_more: false });
});
afterEach(cleanup);
const setup = () => render(<MemoryRouter><AuthenticatedHandoff metadata={plan} /></MemoryRouter>);
it('makes no backend calls until the user checks the connection', async () => {
  setup(); await screen.findByRole('button', { name: 'Check authenticated connection' });
  expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Check authenticated connection' }));
  await screen.findByLabelText('Your AI Film project');
  expect(mocks.check).toHaveBeenCalledWith('account-a');
  expect(mocks.save).not.toHaveBeenCalled();
});
it('discards an in-flight account response after sign-out', async () => {
  let finish: (value: object) => void = () => {};
  mocks.check.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Check authenticated connection' }));
  await act(async () => { mocks.auth?.('SIGNED_OUT', null); finish({ handoff_enabled: true }); });
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
  expect(screen.queryByLabelText('Your AI Film project')).toBeNull();
  expect(mocks.projects).not.toHaveBeenCalled();
});
it('saves only on explicit selection and resets saved state on account change', async () => {
  mocks.save.mockResolvedValue({ id: 'draft', blockers: ['Consent review required'] });
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Check authenticated connection' }));
  fireEvent.change(await screen.findByLabelText('Your AI Film project'), { target: { value: 'owned-project' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save metadata as draft' }));
  await screen.findByText(/Draft saved in your AI Film project/);
  expect(mocks.save.mock.calls[0].slice(0, 3)).toEqual(['account-a', 'owned-project', plan]);
  await act(async () => { mocks.auth?.('SIGNED_IN', { user: { id: 'account-b' } }); });
  await waitFor(() => expect(screen.queryByText(/Draft saved/)).toBeNull());
  expect(screen.queryByLabelText('Your AI Film project')).toBeNull();
});
