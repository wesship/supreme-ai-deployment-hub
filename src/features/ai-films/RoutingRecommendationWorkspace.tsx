import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AIFilmProject } from './assetManagerService';
import { fetchProviderIntelligence } from './providerIntelligenceService';
import {
  buildRoutingRecommendations,
  type RoutingRecommendation,
  type RoutingRecommendationSnapshot,
} from './routingRecommendationService';

type Props = { project: AIFilmProject | null };
type WindowDays = 7 | 30 | 90;

const pct = (value: number) => `${Math.round(value * 100)}%`;
const money = (value: number | null) => value === null ? 'not reported' : `$${value.toFixed(2)}`;

const ActionBadge = ({ recommendation }: { recommendation: RoutingRecommendation }) => {
  if (recommendation.action === 'increase_preference') return <Badge><ArrowUp className="mr-1 h-3.5 w-3.5" />increase</Badge>;
  if (recommendation.action === 'decrease_preference') return <Badge variant="outline"><ArrowDown className="mr-1 h-3.5 w-3.5" />decrease</Badge>;
  return <Badge variant="secondary"><ArrowRight className="mr-1 h-3.5 w-3.5" />hold</Badge>;
};

const RoutingRecommendationWorkspace = ({ project }: Props) => {
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [snapshot, setSnapshot] = useState<RoutingRecommendationSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Recommendations are advisory only and require human approval before any routing policy change.');

  const load = async (window: WindowDays = windowDays) => {
    setBusy(true);
    try {
      const intelligence = await fetchProviderIntelligence(project?.id, window);
      const next = buildRoutingRecommendations(intelligence.decisionQuality);
      setSnapshot(next);
      setMessage(`${next.recommendations.length} evidence-qualified routing recommendations generated from the last ${window} days. No recommendation has been applied.`);
    } catch (error) {
      setSnapshot(null);
      setMessage(error instanceof Error ? error.message : 'Routing recommendations are unavailable.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(windowDays); }, [project?.id, windowDays]);

  const actionable = useMemo(
    () => snapshot?.recommendations.filter((item) => item.proposedAdjustment !== 0).length || 0,
    [snapshot],
  );

  return (
    <section aria-labelledby="routing-recommendation-heading" className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Routing Recommendations</p>
          <h2 id="routing-recommendation-heading" className="mt-2 text-3xl font-bold">Evidence-based proposals, never auto-applied</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Gate 15 converts only evidence-sufficient Gate 14 rollups into bounded preference proposals. It cannot write provider configuration, change activation/canary state, enqueue jobs, or spend provider credits.</p>
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

      <Card className="border-primary/20 p-4 text-sm text-muted-foreground" role="status" aria-live="polite">{message}</Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Qualified proposals</p><p className="mt-1 text-2xl font-bold">{snapshot?.recommendations.length || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Non-zero proposals</p><p className="mt-1 text-2xl font-bold">{actionable}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Max proposed adjustment</p><p className="mt-1 text-2xl font-bold">±{snapshot?.policy.maxAbsoluteAdjustment ?? 5}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Approval mode</p><p className="mt-1 text-xl font-bold">Human required</p></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {(snapshot?.recommendations || []).map((recommendation) => (
          <Card key={recommendation.key} className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold capitalize">{recommendation.provider}</h3>
                  {recommendation.styleId && <Badge variant="secondary">{recommendation.styleId}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{recommendation.judgedSamples} judged outcomes · {pct(recommendation.evidenceCoverageRate)} terminal coverage · {recommendation.confidence} confidence</p>
              </div>
              <div className="flex items-center gap-2">
                <ActionBadge recommendation={recommendation} />
                <Badge variant="outline">{recommendation.proposedAdjustment >= 0 ? '+' : ''}{recommendation.proposedAdjustment}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Pass</p><p className="font-bold">{pct(recommendation.passRate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Adverse</p><p className="font-bold">{pct(recommendation.adverseRate)}</p></div>
              <div><p className="text-xs text-muted-foreground">Mean reported cost</p><p className="font-bold">{money(recommendation.reportedCostUsdMean)}</p></div>
              <div><p className="text-xs text-muted-foreground">Cost coverage</p><p className="font-bold">{pct(recommendation.reportedCostCoverageRate)}</p></div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rationale</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {recommendation.rationale.map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-muted/30 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Human approval required. This proposal is not applied, cannot self-activate a provider, and does not modify the dispatcher.</span>
            </div>
          </Card>
        ))}
      </div>

      {snapshot && snapshot.recommendations.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">No provider or provider/style group has enough judged evidence to generate a recommendation in this {windowDays}-day window. Routing remains unchanged.</Card>
      )}
    </section>
  );
};

export default RoutingRecommendationWorkspace;
