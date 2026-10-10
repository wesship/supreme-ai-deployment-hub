import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, ClipboardCheck, Gauge, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { assuranceFetch } from '@/lib/assurance/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Remediation = { id: string; priority: 'P0' | 'P1' | 'P2'; title: string; status: 'open' | 'in_progress' | 'resolved'; owner?: string; target_date?: string; acceptance_criteria: string[] };
type Overview = { remediations: Remediation[]; performance: Array<{ route: string; metric_name: string; metric_value: number; source: string; created_at: string }>; accessibility: Array<{ route: string; passed: boolean; violation_count: number; executed_at: string }> };

const priorityClass = { P0: 'bg-red-500/15 text-red-300 border-red-400/30', P1: 'bg-amber-500/15 text-amber-200 border-amber-400/30', P2: 'bg-sky-500/15 text-sky-200 border-sky-400/30' };

export default function AssuranceConsole() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Loading assurance posture…');

  const load = async () => {
    setLoading(true);
    try {
      const data = await assuranceFetch<Overview>('/api/assurance/admin/overview');
      setOverview(data);
      setMessage('Assurance posture is current.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load the assurance console.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  const counts = useMemo(() => ({ open: overview?.remediations.filter((item) => item.status === 'open').length || 0, active: overview?.remediations.filter((item) => item.status === 'in_progress').length || 0, resolved: overview?.remediations.filter((item) => item.status === 'resolved').length || 0 }), [overview]);

  const validateMetadata = async () => {
    setMessage('Validating initial HTML metadata for every public sitemap route…');
    try {
      const result = await assuranceFetch<{ passed: boolean; routes: Array<{ route: string; passed: boolean }> }>('/api/assurance/admin/metadata/validate', { method: 'POST' });
      setMessage(result.passed ? `All ${result.routes.length} public routes passed server-response metadata validation.` : `${result.routes.filter((route) => !route.passed).length} public routes require metadata remediation.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Metadata validation failed.'); }
  };

  return <div className="d3-os-shell min-h-screen text-white"><Helmet><title>Assurance Console — D3VONN.IO</title><meta name="robots" content="noindex,nofollow" /></Helmet><div className="container mx-auto max-w-7xl px-4 py-10"><div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Governance control plane</p><h1 className="text-4xl font-bold">Reliability, security, and quality assurance</h1><p className="mt-3 max-w-3xl text-white/65">A server-governed view of audit findings, initial-response SEO integrity, performance samples, accessibility results, and enterprise remediation commitments.</p></div><div className="flex gap-3"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button onClick={() => void validateMetadata()}><ClipboardCheck className="mr-2 h-4 w-4" />Validate metadata</Button></div></div><p role="status" aria-live="polite" className="mb-6 text-sm text-white/65">{message}</p><div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<TriangleAlert className="h-5 w-5 text-red-300" />} label="Open findings" value={counts.open} /><Metric icon={<Activity className="h-5 w-5 text-amber-200" />} label="In progress" value={counts.active} /><Metric icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />} label="Resolved" value={counts.resolved} /><Metric icon={<Gauge className="h-5 w-5 text-sky-300" />} label="Performance samples" value={overview?.performance.length || 0} /></div><div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300" />Remediation progress</CardTitle><CardDescription>Priority, ownership, target date, and acceptance evidence are kept together for operational review.</CardDescription></CardHeader><CardContent className="space-y-3">{overview?.remediations.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Badge className={priorityClass[item.priority]}>{item.priority}</Badge><span className="text-xs uppercase tracking-wide text-white/45">{item.status.replace('_', ' ')}</span></div><h2 className="mt-2 font-semibold">{item.title}</h2><p className="mt-1 text-sm text-white/55">Owner: {item.owner || 'Unassigned'} · Target: {item.target_date ? new Date(item.target_date).toLocaleDateString() : 'Unscheduled'}</p></div></div><ul className="mt-3 space-y-1 text-sm text-white/65">{item.acceptance_criteria?.map((criterion) => <li key={criterion}>• {criterion}</li>)}</ul></div>) || <Empty label="No remediation data is available yet." />}</CardContent></Card><div className="space-y-6"><Card><CardHeader><CardTitle>Performance telemetry</CardTitle><CardDescription>Latest LCP, INP, and CLS values from real users and controlled synthetic checks.</CardDescription></CardHeader><CardContent className="space-y-3">{overview?.performance.slice(0, 6).map((sample, index) => <div key={`${sample.route}-${sample.metric_name}-${index}`} className="flex items-center justify-between border-b border-white/10 pb-3 text-sm"><span>{sample.route} · {sample.metric_name}</span><span className="font-mono text-cyan-200">{sample.metric_value.toFixed(sample.metric_name === 'CLS' ? 3 : 0)}</span></div>) || <Empty label="No performance samples have been recorded." />}</CardContent></Card><Card><CardHeader><CardTitle>Accessibility audit summary</CardTitle><CardDescription>Latest axe-core results evaluated against WCAG 2.2 AA rules.</CardDescription></CardHeader><CardContent className="space-y-3">{overview?.accessibility.slice(0, 6).map((audit) => <div key={`${audit.route}-${audit.executed_at}`} className="flex items-center justify-between border-b border-white/10 pb-3 text-sm"><span>{audit.route}</span><Badge variant="outline" className={audit.passed ? 'border-emerald-400/40 text-emerald-200' : 'border-red-400/40 text-red-200'}>{audit.passed ? 'Pass' : `${audit.violation_count} findings`}</Badge></div>) || <Empty label="Accessibility runs will appear after the first controlled audit." />}</CardContent></Card></div></div></div></div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <Card><CardContent className="p-5"><div className="mb-3 flex items-center gap-2 text-white/55">{icon}<span className="text-xs uppercase tracking-wide">{label}</span></div><p className="text-3xl font-semibold">{value}</p></CardContent></Card>; }
function Empty({ label }: { label: string }) { return <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-white/50">{label}</p>; }
