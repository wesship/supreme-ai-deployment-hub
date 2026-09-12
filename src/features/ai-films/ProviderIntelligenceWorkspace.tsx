import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Clock3, DollarSign, RefreshCw, RotateCcw, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AIFilmProject } from './assetManagerService';
import { fetchProviderIntelligence, type ProviderIntelligenceSnapshot } from './providerIntelligenceService';

type Props = { project: AIFilmProject | null };
type WindowDays = 7 | 30 | 90;

const pct = (value: number) => `${Math.round(value * 100)}%`;
const seconds = (value: number | null) => value === null ? '—' : `${Math.round(value)}s`;
const money = (value: number | null) => value === null ? 'not reported' : `$${value.toFixed(2)}`;
const deltaPct = (value: number | null) => value === null ? 'no prior period' : `${value >= 0 ? '+' : ''}${Math.round(value * 100)} pts`;
const deltaMoney = (value: number | null) => value === null ? 'no prior period' : `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}`;

const Trend = ({ value, inverse = false }: { value: number | null; inverse?: boolean }) => {
  if (value === null || value === 0) return <span className="text-muted-foreground">—</span>;
  const favorable = inverse ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return <span className={favorable ? 'text-emerald-600' : 'text-amber-600'}><Icon className="mr-1 inline h-3.5 w-3.5" />{deltaPct(value)}</span>;
};

const ProviderIntelligenceWorkspace = ({ project }: Props) => {
  const [snapshot, setSnapshot] = useState<ProviderIntelligenceSnapshot | null>(null);
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Provider intelligence uses owner-scoped render history and never changes routing by itself.');

  const load = async (window: WindowDays = windowDays) => {
    setBusy(true);
    try {
      const next = await fetchProviderIntelligence(project?.id, window);
      setSnapshot(next);
      setMessage(`${next.sampledJobs} video jobs analyzed in the last ${window} days versus ${next.previousSampledJobs} in the prior ${window}-day period. Routing adjustments remain bounded to ±15 and require at least 3 QA outcomes.`);
    } catch (error) {
      setSnapshot(null);
      setMessage(error instanceof Error ? error.message : 'Provider intelligence is unavailable.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(windowDays); }, [project?.id, windowDays]);

  const leader = useMemo(() => snapshot?.providers[0] || null, [snapshot]);
  const qualitySamples = snapshot?.providers.reduce((sum, provider) => sum + provider.quality.samples, 0) || 0;
  const reportedCost = snapshot?.providers.reduce((sum, provider) => sum + (provider.reportedCostUsdTotal || 0), 0) || 0;
  const approvedShots = snapshot?.providers.reduce((sum, provider) => sum + provider.approvedShots, 0) || 0;
  const totalCostSamples = snapshot?.providers.reduce((sum, provider) => sum + provider.reportedCostSamples, 0) || 0;
  const aggregateCostPerApproved = reportedCost > 0 && approvedShots > 0 ? reportedCost / approvedShots : null;

  return (
    <section aria-labelledby="provider-intelligence-heading" className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Provider Intelligence</p>
          <h2 id="provider-intelligence-heading" className="mt-2 text-3xl font-bold">Generation Performance Evidence</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Compare quality, reliability, latency, provider-reported spend, approval efficiency, regeneration, style evidence, and bounded routing evidence across matched time windows.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => (
            <Button key={days} type="button" size="sm" variant={windowDays === days ? 'default' : 'outline'} onClick={() => setWindowDays(days as WindowDays)} disabled={busy}>{days}d</Button>
          ))}
          <Button type="button" variant="outline" onClick={() => void load(windowDays)} disabled={busy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{windowDays}d jobs</p><p className="mt-2 text-3xl font-bold">{snapshot?.sampledJobs ?? 0}</p></div><Activity className="h-6 w-6 text-primary" /></div></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">QA outcomes</p><p className="mt-2 text-3xl font-bold">{qualitySamples}</p></div><ShieldCheck className="h-6 w-6 text-primary" /></div></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Approved shots</p><p className="mt-2 text-3xl font-bold">{approvedShots}</p></div><BarChart3 className="h-6 w-6 text-primary" /></div></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Evidence leader</p><p className="mt-2 text-xl font-bold capitalize">{leader?.provider || 'No data'}</p></div><BarChart3 className="h-6 w-6 text-primary" /></div></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Reported cost / approval</p><p className="mt-2 text-xl font-bold">{money(aggregateCostPerApproved)}</p><p className="mt-1 text-xs text-muted-foreground">{totalCostSamples} cost samples</p></div><DollarSign className="h-6 w-6 text-primary" /></div></Card>
      </div>

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {(snapshot?.providers || []).map((provider) => (
          <Card key={provider.provider} className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold capitalize">{provider.provider}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{provider.jobs} jobs · {provider.quality.samples} QA samples · {provider.approvedShots} approved · {provider.styles.length} observed styles</p>
              </div>
              <Badge variant={provider.routingAdjustment > 0 ? 'default' : 'outline'}>{provider.routingAdjustment >= 0 ? '+' : ''}{provider.routingAdjustment} routing</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Pass</p><p className="font-bold">{pct(provider.quality.pass_rate)}</p><p className="mt-1 text-[11px]"><Trend value={provider.passRateDelta} /></p></div>
              <div><p className="text-xs text-muted-foreground">Failure</p><p className="font-bold">{pct(provider.failureRate)}</p><p className="mt-1 text-[11px]"><Trend value={provider.failureRateDelta} inverse /></p></div>
              <div><p className="text-xs text-muted-foreground">Regen</p><p className="font-bold">{pct(provider.regenerationRate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Confidence</p><p className="font-bold">{provider.quality.mean_confidence === null ? '—' : pct(provider.quality.mean_confidence)}</p></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" />Mean latency</div><p className="mt-1 font-semibold">{seconds(provider.meanLatencySeconds)}</p></div>
              <div className="rounded-xl border border-border/70 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-4 w-4" />Reported cost</div><p className="mt-1 font-semibold">{money(provider.reportedCostUsdTotal)}</p><p className="mt-1 text-[11px] text-muted-foreground">coverage {pct(provider.reportedCostCoverageRate)} · {provider.reportedCostSamples} samples</p></div>
              <div className="rounded-xl border border-border/70 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-4 w-4" />Reported cost / approval</div><p className="mt-1 font-semibold">{money(provider.reportedCostPerApprovedShot)}</p><p className="mt-1 text-[11px] text-muted-foreground">vs prior: {deltaMoney(provider.costPerApprovedShotDelta)}</p></div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Cost metrics use provider-reported amounts only and show coverage separately. Missing billing data is never estimated. Routing remains advisory; activation and canary gates are separate.</span>
            </div>
          </Card>
        ))}
      </div>

      {snapshot && snapshot.providers.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No owner-scoped video render history is available in this {windowDays}-day window. Baseline routing remains unchanged.</Card>
      )}
    </section>
  );
};

export default ProviderIntelligenceWorkspace;
