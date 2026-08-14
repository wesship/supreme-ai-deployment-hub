import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Edit3, ListFilter, Plus, RefreshCw, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { primetimeRelease1Api, type PrimetimeRecord } from '@/lib/primetimeRelease1Api';
import { primetimeCustomListsApi, type PrimetimeCustomList } from '@/lib/primetimeCustomListsApi';
import { PrimetimeCustomListMembersDialog } from '@/components/primetime/PrimetimeCustomListMembersDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function recordValue(record: PrimetimeRecord, key: string, fallback = 'Workspace') {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function formattedDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

interface EditorState {
  open: boolean;
  list: PrimetimeCustomList | null;
}

export default function PrimetimeCustomLists() {
  const [workspaces, setWorkspaces] = useState<PrimetimeRecord[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [role, setRole] = useState('');
  const [lists, setLists] = useState<PrimetimeCustomList[]>([]);
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<EditorState>({ open: false, list: null });
  const [archiveCandidate, setArchiveCandidate] = useState<PrimetimeCustomList | null>(null);
  const [memberList, setMemberList] = useState<PrimetimeCustomList | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    primetimeRelease1Api.listWorkspaces()
      .then((items) => {
        setWorkspaces(items);
        const first = items[0]?.id;
        if (typeof first === 'string') setWorkspaceId(first);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load PRIMETIME workspaces'));
  }, []);

  async function loadLists(currentWorkspaceId = workspaceId) {
    if (!currentWorkspaceId) return;
    setLoading(true);
    setError('');
    try {
      const [customLists, dashboard] = await Promise.all([
        primetimeCustomListsApi.list(currentWorkspaceId, includeArchived),
        primetimeRelease1Api.getDailyDashboard(currentWorkspaceId),
      ]);
      setLists(customLists);
      setRole(dashboard.role);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load custom lists');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLists(workspaceId);
  }, [workspaceId, includeArchived]);

  const filteredLists = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return lists;
    return lists.filter((list) => `${list.display_name} ${list.description}`.toLowerCase().includes(normalized));
  }, [lists, query]);

  const canArchive = role === 'manager' || role === 'workspace_admin';

  function openCreate() {
    setDisplayName('');
    setDescription('');
    setEditor({ open: true, list: null });
  }

  function openEdit(list: PrimetimeCustomList) {
    setDisplayName(list.display_name);
    setDescription(list.description);
    setEditor({ open: true, list });
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !displayName.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editor.list) {
        await primetimeCustomListsApi.update(editor.list.id, {
          workspace_id: workspaceId,
          display_name: displayName.trim(),
          description: description.trim(),
        });
      } else {
        await primetimeCustomListsApi.create({
          workspace_id: workspaceId,
          display_name: displayName.trim(),
          description: description.trim(),
        });
      }
      setEditor({ open: false, list: null });
      await loadLists();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save custom list');
    } finally {
      setSaving(false);
    }
  }

  async function archiveList() {
    if (!archiveCandidate || !workspaceId) return;
    setSaving(true);
    setError('');
    try {
      await primetimeCustomListsApi.archive(archiveCandidate.id, workspaceId);
      setArchiveCandidate(null);
      await loadLists();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to archive custom list');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">PRIMETIME CRM</p>
              <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Governed Custom Lists</h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Build workspace-scoped contact groups with authenticated access, role enforcement, soft archival, derived member counts, and transactionally coupled audit evidence.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link to="/primetime" className="rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10">CRM workspace</Link>
                <Link to="/primetime/scheduling" className="rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10">Scheduling</Link>
                <Link to="/primetime/communications" className="rounded-lg border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10">Communications</Link>
              </div>
            </div>
            <label className="min-w-72 text-sm text-slate-300">
              Workspace
              <select
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-blue-400"
              >
                <option value="">Select workspace</option>
                {workspaces.map((workspace) => (
                  <option key={recordValue(workspace, 'id')} value={recordValue(workspace, 'id')}>
                    {recordValue(workspace, 'name', recordValue(workspace, 'slug'))}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {error && <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search custom lists</span>
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search custom lists"
                className="border-white/10 bg-slate-950 pl-9 text-white"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300">
              <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
              Include archived
            </label>
            <Button variant="outline" onClick={() => void loadLists()} disabled={!workspaceId || loading} className="border-white/10 bg-transparent text-white hover:bg-white/10">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={openCreate} disabled={!workspaceId || loading}>
              <Plus className="mr-2 h-4 w-4" /> Create custom list
            </Button>
          </div>

          <div className="grid gap-4 border-b border-white/10 p-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-4"><ListFilter className="h-5 w-5 text-blue-300" /><p className="mt-2 text-2xl font-bold">{lists.length}</p><p className="text-sm text-slate-400">Visible lists</p></div>
            <div className="rounded-xl bg-white/5 p-4"><UsersRound className="h-5 w-5 text-emerald-300" /><p className="mt-2 text-2xl font-bold">{lists.reduce((sum, list) => sum + list.record_count, 0)}</p><p className="text-sm text-slate-400">Active memberships</p></div>
            <div className="rounded-xl bg-white/5 p-4"><ShieldCheck className="h-5 w-5 text-amber-300" /><p className="mt-2 text-sm font-semibold">Server governed</p><p className="text-sm text-slate-400">Role checks + atomic audit RPCs</p></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-3">Display name</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Records</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400">Loading custom lists…</td></tr>}
                {!loading && filteredLists.map((list) => (
                  <tr key={list.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-white">{list.display_name}</td>
                    <td className="max-w-xl px-4 py-3 text-slate-300">{list.description || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{list.record_count.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">{formattedDate(list.updated_at)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${list.archived_at ? 'bg-slate-700 text-slate-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{list.archived_at ? 'Archived' : 'Active'}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setMemberList(list)} disabled={Boolean(list.archived_at)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-emerald-300 disabled:opacity-30" aria-label={`Manage members for ${list.display_name}`}><UsersRound className="h-4 w-4" /></button>
                        <button onClick={() => openEdit(list)} disabled={Boolean(list.archived_at)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-blue-300 disabled:opacity-30" aria-label={`Edit ${list.display_name}`}><Edit3 className="h-4 w-4" /></button>
                        <button onClick={() => setArchiveCandidate(list)} disabled={Boolean(list.archived_at) || !canArchive} className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30" aria-label={`Archive ${list.display_name}`} title={canArchive ? 'Archive list' : 'Manager or workspace admin required'}><Archive className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredLists.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center"><p className="font-semibold text-white">No custom lists found</p><p className="mt-1 text-slate-400">Choose a workspace, adjust the search, or create the first governed list.</p></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={editor.open} onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}>
        <DialogContent>
          <form onSubmit={submitEditor} className="space-y-5">
            <DialogHeader><DialogTitle>{editor.list ? 'Edit custom list' : 'Create custom list'}</DialogTitle><DialogDescription>Changes are workspace-scoped, role-checked by the API, and committed with their audit evidence in one database transaction.</DialogDescription></DialogHeader>
            <div className="space-y-2"><Label htmlFor="custom-list-name">Display name</Label><Input id="custom-list-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} required autoFocus /></div>
            <div className="space-y-2"><Label htmlFor="custom-list-description">Description</Label><Textarea id="custom-list-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditor({ open: false, list: null })}>Cancel</Button><Button type="submit" disabled={saving || !displayName.trim()}>{saving ? 'Saving…' : editor.list ? 'Save changes' : 'Create list'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PrimetimeCustomListMembersDialog
        workspaceId={workspaceId}
        list={memberList}
        onOpenChange={(open) => { if (!open) setMemberList(null); }}
        onChanged={() => void loadLists()}
      />

      <AlertDialog open={Boolean(archiveCandidate)} onOpenChange={(open) => { if (!open) setArchiveCandidate(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archive custom list?</AlertDialogTitle><AlertDialogDescription>{archiveCandidate ? `“${archiveCandidate.display_name}” will leave active views. Its people records and audit history will remain intact.` : 'The list will leave active views.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void archiveList()} disabled={saving || !canArchive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Archive list</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
