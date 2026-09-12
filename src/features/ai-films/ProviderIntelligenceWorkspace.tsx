import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Clock3, DollarSign, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AIFilmProject } from './assetManagerService';
import { fetchProviderIntelligence, type ProviderIntelligenceSnapshot } from './providerIntelligenceService';

type Props = { project: AIFilmProject | null };

const pct = (value: number) => `${Math.round(value * 100)}%`;
const seconds = (value: number | null) => value === null ? '—' : `${Math.round(value)}s`;
const money = (value: number | null) => value === null ? 'not reported' : `$${value.toFixed(2)}`;

const ProviderIntelligenceWorkspace = ({ project }: Props) => {
  const [snapshot, setSnapshot] = useState<ProviderIntelligenceSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Provider intelligence uses owner-scoped render history and never changes routing by itself.');

  const load = async () => {
    setBusy(true);
    try {
      const next = await fetchProviderIntelligence(project?.id);
      setSnapshot(next);
      setMessage(`${next.sampledJobs} recent video render jobs analyzed. Routing adjustments remain bounded to ±15 and require at least 3 QA outcomes.`);
    } catch (error) {
      setSnapshot(null);
      setMessage(error instanceof Error ? error.message : 'Provider intelligence is unavailable.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, [project?.id]);

  const leader = useMemo(() => snapshot?.providers[0] || null, [snapshot]);
  const qualitySamples = snapshot?.providers.reduce((sum, provider) => sum + provider.quality.samples, 0) || 0;
  const reportedCost = snapshot?.providers.reduce((sum, provider) => sum + (provider.reportedCostUsdTotal || 0), 0) || 0;

  return (
    <section aria-labelledby="provider-intelligence-heading" className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Provider Intelligence</p>
          <h2 id="provider-intelligence-heading" className="mt-2 text-3xl font-bold">Generation Performance Evidence</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Compare provider quality, failure rate, latency, reported cost, regeneration rate, style evidence, and the exact bounded routing nudge generated from QA history.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh evidence
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Sampled jobs</p><p className="mt-2 text-3xl font-bold">{snapshot?.sampledJobs ?? 0}</p></div><Activity className="h-6 w-6 text-primary" /></div></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">QA outcomes</p><p className="mt-2 text-3xl font-bold">{qualitySamples}</p></div><ShieldCheck className="h-6 w-6 text-primary" /></div></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Evidence leader</p><p className="mt-2 text-xl font-bold capitalize">{leader?.provider || 'No data'}</p></div><BarChart3 className="h-6 w-6 text-primary" /></div></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Reported cost</p><p className="mt-2 text-xl font-bold">{reportedCost ? `$${reportedCost.toFixed(2)}` : '—'}</p></div><DollarSign className="h-6 w-6 text-primary" /></div></Card>
      </div>

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {(snapshot?.providers || []).map((provider) => (
          <Card key={provider.provider} className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold capitalize">{provider.provider}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{provider.jobs} jobs · {provider.quality.samples} QA samples · {provider.styles.length} observed styles</p>
              </div>
              <Badge variant={provider.routingAdjustment > 0 ? 'default' : 'outline'}>{provider.routingAdjustment >= 0 ? '+' : ''}{provider.routingAdjustment} routing</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Pass</p><p className="font-bold">{pct(provider.quality.pass_rate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Failure</p><p className="font-bold">{pct(provider.failureRate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Regen</p><p className="font-bold">{pct(provider.regenerationRate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Confidence</p><p className="font-bold">{provider.quality.mean_confidence === null ? '—' : pct(provider.quality.mean_confidence)}</p></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" />Mean latency</div><p className="mt-1 font-semibold">{seconds(provider.meanLatencySeconds)}</p></div>
              <div className="rounded-xl border border-border/70 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-4 w-4" />Provider-reported cost</div><p className="mt-1 font-semibold">{money(provider.reportedCostUsdTotal)} <span className="font-normal text-muted-foreground">({provider.reportedCostSamples} samples)</span></p></div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Routing evidence is advisory only. Fewer than 3 QA outcomes always produces a zero adjustment; activation/canary gates remain separate.</span>
            </div>
          </Card>
        ))}
      </div>

      {snapshot && snapshot.providers.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No owner-scoped video render history is available for this project yet. Baseline routing remains unchanged.</Card>
      )}
    </section>
  );
};

export default ProviderIntelligenceWorkspace;
