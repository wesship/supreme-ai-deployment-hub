import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Siren,
  Smartphone,
} from 'lucide-react';
import GuardianInstallPrompt from '@/components/security/GuardianInstallPrompt';
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

type EmergencyCategory = 'account' | 'phone' | 'money' | 'device' | 'unsure';

const emergencyLabels: Record<EmergencyCategory, string> = {
  account: 'Someone may be in my account',
  phone: 'My phone or SIM seems wrong',
  money: 'My bank or money may be affected',
  device: 'My computer or device seems compromised',
  unsure: "I'm not sure — something feels wrong",
};

async function authFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to open Security Guardian.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
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
  if (severity === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-100';
  if (severity === 'high') return 'border-orange-500/40 bg-orange-500/10 text-orange-100';
  if (severity === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-100';
  return 'border-white/10 bg-white/[0.03] text-zinc-300';
}

function friendlyEventName(eventType: string) {
  const names: Record<string, string> = {
    'user.emergency_mode_activated': 'Emergency help started',
    'authentication.new_device': 'New device noticed',
    'authentication.login': 'Account sign-in detected',
    'identity.mfa_removed': 'Security verification changed',
    'token.oauth_created': 'New app access granted',
    'response.approval_required': 'Security review needed',
  };
  return names[eventType] || eventType.replaceAll('.', ' ').replaceAll('_', ' ');
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('emergency') === '1' || params.get('mode') === 'emergency';
  });
  const [activeEmergency, setActiveEmergency] = useState<EmergencyCategory | null>(null);

  const selected = useMemo(
    () => organizations.find((org) => org.id === selectedId) || null,
    [organizations, selectedId],
  );

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
    loadTenant(selectedId).catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load protection status.'));
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
      setMessage('Protection profile created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create protection profile.');
    } finally {
      setBusy(false);
    }
  };

  const startEmergency = async (category: EmergencyCategory) => {
    if (!selectedId) return;
    setBusy(true);
    setMessage('');
    try {
      await authFetch(`/api/security/guardian/organizations/${selectedId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'user.emergency_mode_activated',
          severity: 'critical',
          source: 'guardian_mobile_app',
          metadata: {
            category,
            initiated_by_user: true,
            containment_executed: false,
          },
        }),
      });
      setActiveEmergency(category);
      await loadTenant(selectedId);
      setMessage('Emergency mode is active. No automatic account changes were made.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start emergency mode.');
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
      setMessage(`Safe test complete: ${result.events_created} test events. No containment was executed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Safe test failed.');
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
        ? 'Protection setup passed the pilot safety checks.'
        : `Setup needs attention: ${(result.certification.blockers || []).join(', ')}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Certification failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6 text-zinc-300">
        <Loader2 className="mr-3 h-6 w-6 animate-spin" />Opening Guardian…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0a] text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pt-9">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
            <ShieldCheck className="h-4 w-4" />D3VONN Security Guardian
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Personal protection</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Simple account and device safety with guided emergency help.</p>
            </div>
            <GuardianInstallPrompt />
          </div>
        </header>

        {message && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-zinc-200" role="status">
            {message}
          </div>
        )}

        {organizations.length === 0 ? (
          <form onSubmit={createOrganization} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Smartphone className="h-7 w-7 text-emerald-300" />
              <div>
                <h2 className="text-xl font-semibold">Set up personal protection</h2>
                <p className="mt-1 text-sm text-zinc-400">This creates a private security space for one person.</p>
              </div>
            </div>
            <label className="mt-6 block text-sm text-zinc-300">
              Name
              <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Mom — Personal Guardian" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black px-4 outline-none focus:border-emerald-400/60" />
            </label>
            <label className="mt-4 block text-sm text-zinc-300">
              Private workspace name
              <input required minLength={3} pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="mom-personal-guardian" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black px-4 outline-none focus:border-emerald-400/60" />
            </label>
            <button disabled={busy} className="mt-6 min-h-12 w-full rounded-xl bg-emerald-400 px-5 text-base font-bold text-black disabled:opacity-50">
              {busy ? 'Creating…' : 'Start protection'}
            </button>
          </form>
        ) : (
          <>
            <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Current status</p>
                  <h2 className="mt-2 text-3xl font-semibold">Guardian is watching</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{selected?.name} is isolated in a private protection workspace.</p>
                </div>
                <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-300" />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-2xl font-semibold">{overview?.events_observed ?? 0}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">Events</p></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-2xl font-semibold">{overview?.high_or_critical ?? 0}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">Important</p></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-2xl font-semibold capitalize">{certification?.status === 'certified' ? 'Yes' : 'Setup'}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">Certified</p></div>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setEmergencyOpen(true)}
              className="mt-5 flex min-h-20 w-full items-center justify-center rounded-2xl bg-red-600 px-5 text-xl font-extrabold tracking-tight text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 focus:outline-none focus:ring-4 focus:ring-red-400/30"
            >
              <Siren className="mr-3 h-7 w-7" />I’M UNDER ATTACK
            </button>
            <p className="mt-2 text-center text-xs leading-5 text-zinc-500">Use this if an account, phone, bank, or device suddenly feels wrong.</p>

            {emergencyOpen && (
              <section className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/[0.07] p-5" aria-live="polite">
                {!activeEmergency ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">Emergency mode</p><h2 className="mt-2 text-2xl font-semibold">What seems wrong?</h2></div>
                      <button type="button" onClick={() => setEmergencyOpen(false)} className="min-h-11 rounded-xl border border-white/10 px-3 text-sm text-zinc-300">Close</button>
                    </div>
                    <div className="mt-5 grid gap-3">
                      {(Object.entries(emergencyLabels) as [EmergencyCategory, string][]).map(([category, label]) => (
                        <button key={category} type="button" disabled={busy} onClick={() => startEmergency(category)} className="min-h-14 rounded-xl border border-white/10 bg-black/30 px-4 text-left text-sm font-semibold text-white hover:bg-black/45 disabled:opacity-50">
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">Emergency mode active</p>
                    <h2 className="mt-2 text-2xl font-semibold">{emergencyLabels[activeEmergency]}</h2>
                    <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-200">
                      <div className="rounded-xl border border-white/10 bg-black/25 p-4"><strong>1. Use a trusted device.</strong><br />Stop entering passwords or verification codes into anything suspicious.</div>
                      <div className="rounded-xl border border-white/10 bg-black/25 p-4"><strong>2. Never share a verification code.</strong><br />Do not read login codes to someone who called or texted you.</div>
                      <div className="rounded-xl border border-white/10 bg-black/25 p-4"><strong>3. Protect email and phone first.</strong><br />They are often the recovery keys for your other accounts.</div>
                      <div className="rounded-xl border border-white/10 bg-black/25 p-4"><strong>4. Contact the real provider directly.</strong><br />For banking or SIM problems, use the official app, website, card number, or known support number.</div>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-zinc-400">Guardian recorded that you asked for emergency help. It did not lock accounts, move money, or change credentials automatically.</p>
                    <button type="button" onClick={() => { setActiveEmergency(null); setEmergencyOpen(false); }} className="mt-5 min-h-12 w-full rounded-xl border border-white/15 bg-white/[0.05] font-semibold text-white">Close emergency guide</button>
                  </>
                )}
              </section>
            )}

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold">Recent alerts</h2><p className="mt-1 text-xs text-zinc-500">Newest security activity first</p></div>
                <button type="button" onClick={() => loadTenant(selectedId)} disabled={busy} aria-label="Refresh alerts" className="min-h-11 min-w-11 rounded-xl border border-white/10 p-3 text-zinc-300"><RefreshCw className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 space-y-3">
                {overview?.recent_events?.length ? overview.recent_events.slice(0, 5).map((event) => (
                  <div key={event.id} className={`rounded-xl border p-4 ${severityClass(event.severity)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-sm font-semibold capitalize">{friendlyEventName(event.event_type)}</p><p className="mt-1 text-xs opacity-70">{event.synthetic ? 'Safe test event' : 'Guardian event'}</p></div>
                      <span className="text-[10px] font-bold uppercase tracking-wider">{event.severity}</span>
                    </div>
                  </div>
                )) : <p className="rounded-xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-500">No security alerts yet.</p>}
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="flex min-h-14 w-full items-center justify-between px-5 text-left text-sm font-semibold text-zinc-300">
                Advanced setup & pilot tools
                {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {advancedOpen && (
                <div className="border-t border-white/10 p-5">
                  {organizations.length > 1 && (
                    <select aria-label="Protection workspace" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mb-4 min-h-12 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 text-sm text-zinc-100">
                      {organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.role}</option>)}
                    </select>
                  )}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button onClick={simulate} disabled={busy} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold disabled:opacity-50"><Play className="mr-2 h-4 w-4" />Run safe test</button>
                    <button onClick={certify} disabled={busy} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-emerald-400 px-4 text-sm font-bold text-black disabled:opacity-50"><ShieldCheck className="mr-2 h-4 w-4" />Certify protection</button>
                  </div>
                  {certification && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-sm"><span className="text-zinc-400">Safety readiness</span><span className="font-semibold">{certification.score}%</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${certification.score}%` }} /></div>
                      {certification.blockers?.length > 0 && <div className="mt-4 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs leading-5 text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{certification.blockers.join(', ')}</div>}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
