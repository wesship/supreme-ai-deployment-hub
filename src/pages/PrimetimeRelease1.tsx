import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { PrimetimeRelease1Forms } from '@/components/primetime/PrimetimeRelease1Forms';
import { primetimeRelease1Api, type PrimetimeDashboard, type PrimetimeRecord } from '@/lib/primetimeRelease1Api';

function value(record: PrimetimeRecord, key: string, fallback = '—') {
  const current = record[key];
  return typeof current === 'string' || typeof current === 'number' ? String(current) : fallback;
}

function shortDate(value: unknown) {
  if (typeof value !== 'string' || !value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">{label}</p>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof UsersRound }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className="rounded-full bg-blue-500/10 p-3 text-blue-300">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export default function PrimetimeRelease1() {
  const [workspaces, setWorkspaces] = useState<PrimetimeRecord[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [dashboard, setDashboard] = useState<PrimetimeDashboard | null>(null);
  const [people, setPeople] = useState<PrimetimeRecord[]>([]);
  const [leads, setLeads] = useState<PrimetimeRecord[]>([]);
  const [stages, setStages] = useState<PrimetimeRecord[]>([]);
  const [exceptions, setExceptions] = useState<PrimetimeRecord[]>([]);
  const [duplicates, setDuplicates] = useState<PrimetimeRecord[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [duplicateEmail, setDuplicateEmail] = useState('');
  const [duplicatePhone, setDuplicatePhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    primetimeRelease1Api.listWorkspaces()
      .then((items) => {
        setWorkspaces(items);
        const first = items[0]?.id;
        if (typeof first === 'string') setWorkspaceId(first);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load PRIMETIME workspaces'));
  }, []);

  async function loadWorkspace(currentWorkspaceId = workspaceId) {
    if (!currentWorkspaceId) return;
    setLoading(true);
    setError('');
    try {
      const [daily, peopleRows, leadRows, stageRows, exceptionRows] = await Promise.all([
        primetimeRelease1Api.getDailyDashboard(currentWorkspaceId),
        primetimeRelease1Api.listPeople(currentWorkspaceId, peopleQuery),
        primetimeRelease1Api.listLeads(currentWorkspaceId),
        primetimeRelease1Api.listPipelineStages(currentWorkspaceId),
        primetimeRelease1Api.listExceptions(currentWorkspaceId),
      ]);
      setDashboard(daily);
      setPeople(peopleRows);
      setLeads(leadRows);
      setStages(stageRows);
      setExceptions(exceptionRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load PRIMETIME workspace');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace(workspaceId);
  }, [workspaceId, peopleQuery]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, PrimetimeRecord[]>();
    for (const stage of stages) {
      const id = value(stage, 'id');
      map.set(id, []);
    }
    for (const lead of leads) {
      const stageId = value(lead, 'pipeline_stage_id');
      const bucket = map.get(stageId) || [];
      bucket.push(lead);
      map.set(stageId, bucket);
    }
    return map;
  }, [leads, stages]);

  async function runDuplicateSearch() {
    if (!workspaceId || (!duplicateEmail && !duplicatePhone)) return;
    setError('');
    try {
      setDuplicates(await primetimeRelease1Api.findDuplicatePeople(workspaceId, duplicateEmail, duplicatePhone));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search duplicates');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">PRIMETIME Release 1</p>
              <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Governed CRM Workspace</h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Daily operating dashboard, lead control, pipeline visibility, exception review, and duplicate contact review for the insurance CRM foundation.
              </p>
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
                  <option key={value(workspace, 'id')} value={value(workspace, 'id')}>
                    {value(workspace, 'name', value(workspace, 'slug', 'Workspace'))}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Open leads" value={dashboard?.summary.openLeadCount ?? '—'} icon={UsersRound} />
          <StatCard label="Open tasks" value={dashboard?.summary.openTaskCount ?? '—'} icon={CalendarClock} />
          <StatCard label="Open exceptions" value={dashboard?.summary.exceptionCount ?? '—'} icon={AlertTriangle} />
        </section>

        <PrimetimeRelease1Forms
          workspaceId={workspaceId}
          userId={dashboard?.userId || ''}
          people={people}
          leads={leads}
          stages={stages}
          onChanged={() => void loadWorkspace()}
        />

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">Lead pipeline</h2>
              {loading && <span className="text-xs uppercase tracking-wide text-blue-300">Loading</span>}
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {stages.length === 0 && <EmptyState label="No pipeline stages returned yet. Seed canonical stages after the database migration is applied." />}
              {stages.map((stage) => {
                const rows = leadsByStage.get(value(stage, 'id')) || [];
                return (
                  <div key={value(stage, 'id')} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-white">{value(stage, 'name', 'Stage')}</h3>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300">{rows.length}</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {rows.slice(0, 5).map((lead) => (
                        <article key={value(lead, 'id')} className="rounded-lg bg-white/5 p-3 text-sm">
                          <p className="font-medium text-white">{value(lead, 'source', 'Lead')}</p>
                          <p className="mt-1 text-slate-400">Next: {value(lead, 'next_action')}</p>
                          <p className="text-slate-500">Due: {shortDate(lead.next_action_due_at)}</p>
                        </article>
                      ))}
                      {rows.length === 0 && <p className="text-sm text-slate-500">No open leads in this stage.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-xl font-semibold text-white">Exception queue</h2>
            <p className="mt-2 text-sm text-slate-400">Records missing Release 1 controls enter this queue.</p>
            <div className="mt-4 space-y-3">
              {exceptions.length === 0 && <EmptyState label="No open exceptions returned." />}
              {exceptions.map((item) => (
                <article key={value(item, 'id')} className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm">
                  <p className="font-semibold text-amber-100">{value(item, 'rule_code', 'Exception')}</p>
                  <p className="text-amber-100/70">{value(item, 'entity_type')} · {value(item, 'severity')}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">People search</h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  value={peopleQuery}
                  onChange={(event) => setPeopleQuery(event.target.value)}
                  placeholder="Search people"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {people.length === 0 && <EmptyState label="No people returned." />}
              {people.slice(0, 10).map((person) => (
                <article key={value(person, 'id')} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <p className="font-semibold text-white">{value(person, 'first_name')} {value(person, 'last_name')}</p>
                  <p className="text-slate-400">{value(person, 'email')} · {value(person, 'phone')}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <h2 className="text-xl font-semibold text-white">Duplicate review</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">First-pass duplicate check by email or phone before creating a new person.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={duplicateEmail}
                onChange={(event) => setDuplicateEmail(event.target.value)}
                placeholder="Email"
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
              />
              <input
                value={duplicatePhone}
                onChange={(event) => setDuplicatePhone(event.target.value)}
                placeholder="Phone"
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
              />
            </div>
            <button
              onClick={runDuplicateSearch}
              className="mt-3 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!workspaceId || (!duplicateEmail && !duplicatePhone)}
            >
              Search duplicates
            </button>
            <div className="mt-4 space-y-3">
              {duplicates.length === 0 && <p className="text-sm text-slate-500">No duplicate search results yet.</p>}
              {duplicates.map((person) => (
                <article key={value(person, 'id')} className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm">
                  <p className="font-semibold text-emerald-100">{value(person, 'first_name')} {value(person, 'last_name')}</p>
                  <p className="text-emerald-100/70">{value(person, 'email')} · {value(person, 'phone')}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-300" />
            <h2 className="text-xl font-semibold text-white">Daily operating queue</h2>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold text-slate-200">Leads requiring action</h3>
              <div className="mt-3 space-y-3">
                {(dashboard?.openLeads || []).length === 0 && <EmptyState label="No open lead actions returned." />}
                {(dashboard?.openLeads || []).map((lead) => (
                  <article key={value(lead, 'id')} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <p className="font-semibold text-white">{value(lead, 'next_action')}</p>
                    <p className="text-slate-400">Due: {shortDate(lead.next_action_due_at)}</p>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-200">Open tasks</h3>
              <div className="mt-3 space-y-3">
                {(dashboard?.openTasks || []).length === 0 && <EmptyState label="No open tasks returned." />}
                {(dashboard?.openTasks || []).map((task) => (
                  <article key={value(task, 'id')} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                    <p className="font-semibold text-white">{value(task, 'title')}</p>
                    <p className="text-slate-400">{value(task, 'priority')} · Due: {shortDate(task.due_at)}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
