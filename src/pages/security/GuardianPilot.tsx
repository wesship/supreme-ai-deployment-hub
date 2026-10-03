import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.d3vonn.io').replace(/\/$/, '');

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
};

type GuardianEvent = {
  id: string;
  event_type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  source: string;
  occurred_at: string;
  synthetic: boolean;
};

type Overview = {
  organization_id: string;
  role: string;
  protection_status: string;
  events_observed: number;
  high_or_critical: number;
  critical: number;
  recent_events: GuardianEvent[];
};

type Certification = {
  id?: string;
  status: 'blocked' | 'ready' | 'certified' | 'expired';
  score: number;
  checks: Record<string, boolean>;
  blockers: string[];
  evidence_hash: string;
  certified_at?: string | null;
};

async function authFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to open Security Guardian.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.detail || 'Security Guardian request failed.');
  return body;
}

function severityClass(severity: GuardianEvent['severity']) {
  if (severity === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-200';
  if (severity === 'high') return 'border-orange-500/40 bg-orange-500/10 text-orange-200';
  if (severity === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-100';
  return 'border-white/10 bg-white/[0.03] text-zinc-300';
}

export default function GuardianPilot() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [certification, setCertification] = useState<Certification | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const selected = useMemo(() => organizations.find((org) => org.id === selectedId) || null, [organizations, selectedId]);

  const loadOrganizations = useCallback(async () => {
    const result = await authFetch('/api/security/guardian/organizations');
    const rows = (result.organizations || []) as Organization[];
    setOrganizations(rows);
    setSelectedId((current) => current || rows[0]?.id || '');
  }, []);

  const loadTenant = useCallback(async (organizationId: string) => {
    if (!organizationId) {
      setOverview(null);
      setCertification(null);
      return;
    }
    const nextOverview = await authFetch(`/api/security/guardian/organizations/${organizationId}/overview`);
    setOverview(nextOverview);
    try {
      const result = await authFetch(`/api/security/guardian/organizations/${organizationId}/pilot/certification`);
      setCertification(result.certification);
    } catch {
      setCertification(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadOrganizations();
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : 'Could not load Security Guardian.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [loadOrganizations]);

  useEffect(() => {
    if (!selectedId) return;
    loadTenant(selectedId).catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load organization.'));
  }, [selectedId, loadTenant]);

  const createOrganization = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await authFetch('/api/security/guardian/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
      });
      await loadOrganizations();
      setSelectedId(result.organization.id);
      setName('');
      setSlug('');
      setMessage('Pilot organization created. Run the safe simulation next.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create organization.');
    } finally {
      setBusy(false);
    }
  };

  const simulate = async () => {
    if (!selectedId) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await authFetch(`/api/security/guardian/organizations/${selectedId}/pilot/simulate`, { method: 'POST' });
      await loadTenant(selectedId);
      setMessage(`Safe simulation complete: ${result.events_created} synthetic events, no containment executed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Simulation failed.');
    } finally {
      setBusy(false);
    }
  };

  const certify = async () => {
    if (!selectedId) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await authFetch(`/api/security/guardian/organizations/${selectedId}/pilot/certify`, { method: 'POST' });
      setCertification(result.certification);
      setMessage(result.certification.status === 'certified'
        ? 'Pilot certification passed.'
        : `Certification blocked: ${(result.certification.blockers || []).join(', ')}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Certification failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-6 text-zinc-300"><Loader2 className="mr-3 h-5 w-5 animate-spin" />Loading Security Guardian…</div>;
  }

  return (
    <div className="min-h-screen bg-[#090a0a] text-zinc-100">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300"><ShieldCheck className="h-4 w-4" />D3VONN Security Guardian</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Client protection pilot</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Tenant-isolated security monitoring and certification. Pilot simulations are synthetic and never execute containment.</p>
          </div>
          {organizations.length > 0 && (
            <select aria-label="Organization" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-400/60">
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.role}</option>)}
            </select>
          )}
        </header>

        {message && <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-zinc-300" role="status">{message}</div>}

        {organizations.length === 0 ? (
          <form onSubmit={createOrganization} className="max-w-xl rounded-xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-xl font-medium">Create your pilot organization</h2>
            <p className="mt-2 text-sm text-zinc-400">Your organization becomes the isolation boundary for events and certifications.</p>
            <label className="mt-6 block text-sm text-zinc-300">Organization name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 outline-none focus:border-emerald-400/60" /></label>
            <label className="mt-4 block text-sm text-zinc-300">Workspace slug<input required minLength={3} pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="acme-security" className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 outline-none focus:border-emerald-400/60" /></label>
            <button disabled={busy} className="mt-6 inline-flex items-center rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create pilot</button>
          </form>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Protection</p><p className="mt-2 text-2xl font-semibold capitalize">{overview?.protection_status || 'Pilot'}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Events</p><p className="mt-2 text-2xl font-semibold">{overview?.events_observed ?? 0}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">High / critical</p><p className="mt-2 text-2xl font-semibold">{overview?.high_or_critical ?? 0}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Certification</p><p className="mt-2 text-2xl font-semibold capitalize">{certification?.status || 'Not run'}</p></div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-6">
                <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-medium">Pilot certification</h2><p className="mt-1 text-sm text-zinc-400">{selected?.name} · {selected?.role}</p></div>{certification?.status === 'certified' ? <CheckCircle2 className="h-7 w-7 text-emerald-300" /> : <AlertTriangle className="h-7 w-7 text-amber-300" />}</div>
                <div className="mt-5 flex flex-wrap gap-3"><button onClick={simulate} disabled={busy} className="inline-flex items-center rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium hover:bg-white/[0.07] disabled:opacity-50"><Play className="mr-2 h-4 w-4" />Run safe simulation</button><button onClick={certify} disabled={busy} className="inline-flex items-center rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"><ShieldCheck className="mr-2 h-4 w-4" />Certify pilot</button><button onClick={() => loadTenant(selectedId)} disabled={busy} aria-label="Refresh" className="rounded-lg border border-white/10 p-2.5 text-zinc-300 hover:bg-white/[0.05]"><RefreshCw className="h-4 w-4" /></button></div>
                {certification && <div className="mt-6"><div className="flex items-center justify-between text-sm"><span className="text-zinc-400">Readiness score</span><span className="font-semibold">{certification.score}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${certification.score}%` }} /></div><div className="mt-5 space-y-2">{Object.entries(certification.checks || {}).map(([key, passed]) => <div key={key} className="flex items-center justify-between border-b border-white/5 py-2 text-sm"><span className="text-zinc-400">{key.replaceAll('_', ' ')}</span><span className={passed ? 'text-emerald-300' : 'text-amber-300'}>{passed ? 'PASS' : 'BLOCKED'}</span></div>)}</div><p className="mt-4 break-all text-xs text-zinc-600">Evidence hash: {certification.evidence_hash}</p></div>}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-6">
                <h2 className="text-lg font-medium">Recent security events</h2>
                <div className="mt-4 space-y-3">{overview?.recent_events?.length ? overview.recent_events.map((event) => <div key={event.id} className={`rounded-lg border p-3 ${severityClass(event.severity)}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{event.event_type}</p><p className="mt-1 text-xs opacity-70">{event.source}{event.synthetic ? ' · synthetic' : ''}</p></div><span className="text-[10px] font-semibold uppercase tracking-wider">{event.severity}</span></div></div>) : <p className="text-sm text-zinc-500">No events yet. Run the safe simulation to validate the pilot path.</p>}</div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
