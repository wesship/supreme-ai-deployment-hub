import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3,
  Download,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

type Sensitivity = 'public' | 'internal' | 'critical';
type VerificationStatus = 'unverified' | 'partial' | 'verified' | 'missing';

type SecretRecord = {
  id: string;
  name: string;
  platform: string;
  environment: string;
  sensitivity: Sensitivity;
  status: string;
  verification_status: VerificationStatus;
  owner: string;
  purpose: string;
  used_by: string[];
  expected_storage_locations: string[];
  verified_storage_locations: string[];
  source_of_truth: string | null;
  rotation_interval_days: number | null;
  last_rotated_at: string | null;
  last_verified_at: string | null;
  expires_at: string | null;
  reference_count: number;
  reference_files: string[];
  last_reference_scan_at: string | null;
  notes: string | null;
  rotation_health: string;
  next_rotation_at: string | null;
  updated_at: string;
};

type AuditRecord = {
  id: string;
  secret_name: string;
  action: string;
  created_at: string;
};

type DraftRecord = {
  name: string;
  platform: string;
  environment: string;
  sensitivity: Sensitivity;
  owner: string;
  purpose: string;
  usedBy: string;
  storageLocations: string;
  sourceOfTruth: string;
  rotationDays: string;
};

const EMPTY_DRAFT: DraftRecord = {
  name: '',
  platform: '',
  environment: 'production',
  sensitivity: 'internal',
  owner: 'D3VONN.IO Platform Owner',
  purpose: '',
  usedBy: '',
  storageLocations: '',
  sourceOfTruth: '',
  rotationDays: '90',
};

const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString() : 'Not recorded';

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'border-slate-700 bg-slate-900 text-slate-300',
    green: 'border-emerald-800 bg-emerald-950/70 text-emerald-300',
    amber: 'border-amber-800 bg-amber-950/70 text-amber-300',
    red: 'border-red-800 bg-red-950/70 text-red-300',
    blue: 'border-blue-800 bg-blue-950/70 text-blue-300',
    purple: 'border-purple-800 bg-purple-950/70 text-purple-300',
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.slate}`}>{children}</span>;
}

export default function SecretsVault() {
  const [records, setRecords] = useState<SecretRecord[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sensitivity, setSensitivity] = useState('all');
  const [environment, setEnvironment] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState<DraftRecord>(EMPTY_DRAFT);

  const loadVault = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [inventoryResult, auditResult] = await Promise.all([
      db.from('secret_inventory_health').select('*').order('sensitivity').order('name'),
      db.from('secret_inventory_audit').select('id, secret_name, action, created_at').order('created_at', { ascending: false }).limit(30),
    ]);

    if (inventoryResult.error) setError(inventoryResult.error.message);
    else setRecords(inventoryResult.data || []);

    if (!auditResult.error) setAudit(auditResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadVault(); }, [loadVault]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesQuery = !normalized || [record.name, record.platform, record.environment, record.owner, record.purpose, ...record.used_by]
        .join(' ').toLowerCase().includes(normalized);
      const matchesSensitivity = sensitivity === 'all' || record.sensitivity === sensitivity;
      const matchesEnvironment = environment === 'all' || record.environment === environment;
      return matchesQuery && matchesSensitivity && matchesEnvironment;
    });
  }, [records, query, sensitivity, environment]);

  const summary = useMemo(() => ({
    total: records.length,
    critical: records.filter((item) => item.sensitivity === 'critical' && !['retired', 'revoked'].includes(item.status)).length,
    due: records.filter((item) => ['due', 'expired'].includes(item.rotation_health)).length,
    unverified: records.filter((item) => item.verification_status !== 'verified').length,
    unreferenced: records.filter((item) => item.reference_count === 0).length,
  }), [records]);

  const createRecord = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.platform.trim() || !draft.purpose.trim()) return;
    setSaving(true);
    setError(null);
    const rotationDays = draft.rotationDays.trim() ? Number(draft.rotationDays) : null;
    const { error: insertError } = await db.from('secret_inventory').insert({
      name: draft.name.trim().toUpperCase(),
      platform: draft.platform.trim(),
      environment: draft.environment,
      sensitivity: draft.sensitivity,
      owner: draft.owner.trim(),
      purpose: draft.purpose.trim(),
      used_by: splitList(draft.usedBy),
      expected_storage_locations: splitList(draft.storageLocations),
      source_of_truth: draft.sourceOfTruth.trim() || null,
      rotation_interval_days: rotationDays,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft(EMPTY_DRAFT);
    setShowAddForm(false);
    await loadVault();
  };

  const recordRotation = async (record: SecretRecord) => {
    if (!window.confirm(`Record that ${record.name} was rotated now? This does not change or store the secret value.`)) return;
    const { error: updateError } = await db.from('secret_inventory').update({
      last_rotated_at: new Date().toISOString(),
      status: 'active',
    }).eq('id', record.id);
    if (updateError) setError(updateError.message);
    else await loadVault();
  };

  const recordVerification = async (record: SecretRecord) => {
    const entered = window.prompt('Enter verified storage locations separated by commas. Do not enter secret values.', record.verified_storage_locations.join(', '));
    if (entered === null) return;
    const locations = splitList(entered);
    const verificationStatus: VerificationStatus = locations.length === 0
      ? 'unverified'
      : locations.length >= record.expected_storage_locations.length
        ? 'verified'
        : 'partial';
    const { error: updateError } = await db.from('secret_inventory').update({
      verified_storage_locations: locations,
      verification_status: verificationStatus,
      last_verified_at: new Date().toISOString(),
      status: verificationStatus === 'verified' ? 'active' : record.status,
    }).eq('id', record.id);
    if (updateError) setError(updateError.message);
    else await loadVault();
  };

  const retireRecord = async (record: SecretRecord) => {
    if (!window.confirm(`Retire ${record.name} from the inventory? This only changes metadata.`)) return;
    const { error: updateError } = await db.from('secret_inventory').update({ status: 'retired' }).eq('id', record.id);
    if (updateError) setError(updateError.message);
    else await loadVault();
  };

  const exportMetadata = () => {
    const safeExport = records.map(({ id, ...record }) => ({ id, ...record }));
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), stores_secret_values: false, records: safeExport }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `d3vonn-secret-inventory-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-blue-300">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.2em]">Security Governance</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">D3VONN Secrets Vault</h1>
            <p className="mt-2 max-w-3xl text-slate-400">Authoritative metadata, rotation policy, storage mapping, reference detection, and audit history. Credential values are never stored here.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void loadVault()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm hover:border-blue-500"><RefreshCw className="h-4 w-4" />Refresh</button>
            <button onClick={exportMetadata} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm hover:border-blue-500"><Download className="h-4 w-4" />Export metadata</button>
            <button onClick={() => setShowAddForm((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500"><Plus className="h-4 w-4" />Add record</button>
          </div>
        </header>

        <div className="rounded-xl border border-emerald-900/70 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          <strong>Zero-value design:</strong> this interface accepts names and governance metadata only. Never paste credentials, private keys, passwords, or tokens into any field.
        </div>

        {error && <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Inventory', value: summary.total, icon: KeyRound, tone: 'text-blue-300' },
            { label: 'Critical', value: summary.critical, icon: ShieldCheck, tone: 'text-red-300' },
            { label: 'Rotation due', value: summary.due, icon: Clock3, tone: 'text-amber-300' },
            { label: 'Unverified', value: summary.unverified, icon: AlertTriangle, tone: 'text-purple-300' },
            { label: 'No references', value: summary.unreferenced, icon: Search, tone: 'text-slate-300' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><Icon className={`h-5 w-5 ${tone}`} /></div>
              <div className="mt-2 text-3xl font-bold">{value}</div>
            </div>
          ))}
        </section>

        {showAddForm && (
          <form onSubmit={createRecord} className="grid gap-4 rounded-xl border border-blue-900 bg-slate-900 p-5 md:grid-cols-2 xl:grid-cols-4">
            <h2 className="text-lg font-semibold md:col-span-2 xl:col-span-4">Add metadata record</h2>
            <input required aria-label="Secret name" placeholder="SECRET_NAME" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
            <input required aria-label="Platform" placeholder="Platform" value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
            <select aria-label="Environment" value={draft.environment} onChange={(event) => setDraft({ ...draft, environment: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option>production</option><option>staging</option><option>development</option><option>ci</option><option>all</option></select>
            <select aria-label="Sensitivity" value={draft.sensitivity} onChange={(event) => setDraft({ ...draft, sensitivity: event.target.value as Sensitivity })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="public">public</option><option value="internal">internal</option><option value="critical">critical</option></select>
            <input required aria-label="Owner" placeholder="Owner" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
            <input required aria-label="Purpose" placeholder="Purpose" value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
            <input aria-label="Used by" placeholder="Used by, comma separated" value={draft.usedBy} onChange={(event) => setDraft({ ...draft, usedBy: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
            <input aria-label="Expected storage locations" placeholder="Expected locations, comma separated" value={draft.storageLocations} onChange={(event) => setDraft({ ...draft, storageLocations: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
            <input aria-label="Source of truth" placeholder="Provider source of truth" value={draft.sourceOfTruth} onChange={(event) => setDraft({ ...draft, sourceOfTruth: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
            <input aria-label="Rotation interval days" type="number" min="1" placeholder="Rotation days" value={draft.rotationDays} onChange={(event) => setDraft({ ...draft, rotationDays: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
            <div className="flex gap-2 md:col-span-2 xl:col-span-4"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save record'}</button><button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border border-slate-700 px-4 py-2">Cancel</button></div>
          </form>
        )}

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input aria-label="Search secrets inventory" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, platform, owner, purpose…" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3" /></label>
            <select aria-label="Filter sensitivity" value={sensitivity} onChange={(event) => setSensitivity(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="all">All sensitivity</option><option value="critical">Critical</option><option value="internal">Internal</option><option value="public">Public</option></select>
            <select aria-label="Filter environment" value={environment} onChange={(event) => setEnvironment(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="all">All environments</option>{Array.from(new Set(records.map((item) => item.environment))).sort().map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Secret</th><th className="px-4 py-3">Classification</th><th className="px-4 py-3">Storage</th><th className="px-4 py-3">Rotation</th><th className="px-4 py-3">References</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Loading vault metadata…</td></tr> : filtered.map((record) => {
                  const sensitivityTone = record.sensitivity === 'critical' ? 'red' : record.sensitivity === 'public' ? 'green' : 'blue';
                  const healthTone = record.rotation_health === 'healthy' ? 'green' : ['due', 'expired'].includes(record.rotation_health) ? 'red' : record.rotation_health === 'due_soon' ? 'amber' : 'slate';
                  const verificationTone = record.verification_status === 'verified' ? 'green' : record.verification_status === 'missing' ? 'red' : 'amber';
                  return <tr key={record.id} className="align-top hover:bg-slate-900">
                    <td className="px-4 py-4"><div className="font-mono font-semibold text-blue-200">{record.name}</div><div className="mt-1 text-slate-400">{record.platform} · {record.environment}</div><div className="mt-2 max-w-sm text-xs text-slate-500">{record.purpose}</div></td>
                    <td className="px-4 py-4"><div className="flex flex-wrap gap-1"><Badge tone={sensitivityTone}>{record.sensitivity}</Badge><Badge tone={record.status === 'active' ? 'green' : 'slate'}>{record.status}</Badge></div><div className="mt-2 text-xs text-slate-500">Owner: {record.owner}</div></td>
                    <td className="px-4 py-4"><Badge tone={verificationTone}>{record.verification_status}</Badge><div className="mt-2 text-xs text-slate-400">{record.verified_storage_locations.length}/{record.expected_storage_locations.length} locations verified</div><div className="mt-1 max-w-xs text-xs text-slate-500">{record.expected_storage_locations.join(' · ') || 'No expected location recorded'}</div></td>
                    <td className="px-4 py-4"><Badge tone={healthTone}>{record.rotation_health}</Badge><div className="mt-2 text-xs text-slate-400">Last: {formatDate(record.last_rotated_at)}</div><div className="mt-1 text-xs text-slate-500">Next: {formatDate(record.next_rotation_at)}</div></td>
                    <td className="px-4 py-4"><div className="font-semibold">{record.reference_count}</div><div className="mt-1 max-w-xs text-xs text-slate-500">{record.reference_files.slice(0, 3).join(' · ') || 'No repository references detected'}</div></td>
                    <td className="px-4 py-4"><div className="flex min-w-32 flex-col gap-2"><button onClick={() => void recordVerification(record)} className="inline-flex items-center gap-1 text-left text-xs text-emerald-300 hover:text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Record verification</button><button onClick={() => void recordRotation(record)} className="inline-flex items-center gap-1 text-left text-xs text-blue-300 hover:text-blue-200"><RotateCw className="h-3.5 w-3.5" />Record rotation</button><button onClick={() => void retireRecord(record)} className="inline-flex items-center gap-1 text-left text-xs text-slate-400 hover:text-white"><Archive className="h-3.5 w-3.5" />Retire</button></div></td>
                  </tr>;
                })}
                {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No records match the current filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent audit history</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {audit.map((item) => <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><div className="font-mono text-sm text-blue-200">{item.secret_name}</div><div className="mt-1 flex items-center justify-between gap-2"><Badge tone="purple">{item.action.replaceAll('_', ' ')}</Badge><span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span></div></div>)}
            {audit.length === 0 && <p className="text-sm text-slate-500">No metadata changes have been recorded yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
