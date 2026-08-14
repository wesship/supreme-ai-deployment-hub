import { useEffect, useMemo, useState } from 'react';
import { Search, UserMinus, UserPlus, UsersRound } from 'lucide-react';
import { primetimeRelease1Api, type PrimetimeRecord } from '@/lib/primetimeRelease1Api';
import {
  primetimeCustomListsApi,
  type PrimetimeCustomList,
  type PrimetimeCustomListMember,
} from '@/lib/primetimeCustomListsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  workspaceId: string;
  list: PrimetimeCustomList | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

function value(record: PrimetimeRecord, key: string, fallback = ''): string {
  const current = record[key];
  return typeof current === 'string' || typeof current === 'number' ? String(current) : fallback;
}

function personName(person: PrimetimeRecord): string {
  const first = value(person, 'first_name');
  const last = value(person, 'last_name');
  return `${first} ${last}`.trim() || value(person, 'email', 'Unnamed contact');
}

export function PrimetimeCustomListMembersDialog({ workspaceId, list, onOpenChange, onChanged }: Props) {
  const [members, setMembers] = useState<PrimetimeCustomListMember[]>([]);
  const [people, setPeople] = useState<PrimetimeRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [changingPersonId, setChangingPersonId] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (!list || !workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const [memberRows, peopleRows] = await Promise.all([
        primetimeCustomListsApi.listMembers(list.id, workspaceId),
        primetimeRelease1Api.listPeople(workspaceId),
      ]);
      setMembers(memberRows);
      setPeople(peopleRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load list members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (list) void load();
    else {
      setMembers([]);
      setPeople([]);
      setQuery('');
      setError('');
    }
  }, [list?.id, workspaceId]);

  const memberIds = useMemo(() => new Set(members.map((member) => member.person_id)), [members]);
  const peopleById = useMemo(() => new Map(people.map((person) => [value(person, 'id'), person])), [people]);
  const candidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return people.filter((person) => {
      const id = value(person, 'id');
      if (!id || memberIds.has(id)) return false;
      if (!normalized) return true;
      const searchable = `${personName(person)} ${value(person, 'email')} ${value(person, 'phone')}`.toLowerCase();
      return searchable.includes(normalized);
    }).slice(0, 20);
  }, [memberIds, people, query]);

  async function add(personId: string) {
    if (!list) return;
    setChangingPersonId(personId);
    setError('');
    try {
      await primetimeCustomListsApi.addMember(list.id, workspaceId, personId);
      await load();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add list member');
    } finally {
      setChangingPersonId('');
    }
  }

  async function remove(personId: string) {
    if (!list) return;
    setChangingPersonId(personId);
    setError('');
    try {
      await primetimeCustomListsApi.removeMember(list.id, personId, workspaceId);
      await load();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove list member');
    } finally {
      setChangingPersonId('');
    }
  }

  return (
    <Dialog open={Boolean(list)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage members{list ? ` — ${list.display_name}` : ''}</DialogTitle>
          <DialogDescription>
            Add or remove people within the active workspace. Each change is role-checked and committed atomically with immutable audit evidence.
          </DialogDescription>
        </DialogHeader>

        {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-emerald-300" />
              <h3 className="font-semibold text-white">Active members</h3>
              <span className="ml-auto rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300">{members.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {loading && <p className="text-sm text-slate-400">Loading members…</p>}
              {!loading && members.length === 0 && <p className="text-sm text-slate-400">No active members.</p>}
              {members.map((member) => {
                const person = peopleById.get(member.person_id);
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{person ? personName(person) : member.person_id}</p>
                      {person && <p className="truncate text-xs text-slate-400">{value(person, 'email', value(person, 'phone', 'No contact detail'))}</p>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void remove(member.person_id)}
                      disabled={changingPersonId === member.person_id}
                      aria-label={`Remove ${person ? personName(person) : member.person_id}`}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <h3 className="font-semibold text-white">Add people</h3>
            <label className="relative mt-3 block">
              <span className="sr-only">Search workspace people</span>
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search workspace people"
                className="border-white/10 bg-slate-950 pl-9 text-white"
              />
            </label>
            <div className="mt-4 space-y-2">
              {!loading && candidates.length === 0 && <p className="text-sm text-slate-400">No eligible people found.</p>}
              {candidates.map((person) => {
                const id = value(person, 'id');
                return (
                  <div key={id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{personName(person)}</p>
                      <p className="truncate text-xs text-slate-400">{value(person, 'email', value(person, 'phone', 'No contact detail'))}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void add(id)}
                      disabled={!id || changingPersonId === id}
                      aria-label={`Add ${personName(person)}`}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
