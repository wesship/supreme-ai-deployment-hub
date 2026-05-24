/**
 * PredictionDashboardPanel.tsx — Operator prediction + advisory cognition panel
 *
 * Displays live predictive operational intelligence:
 *   - Queue saturation risk
 *   - Deployment instability
 *   - Observability blind spots
 *   - Runtime degradation trajectories
 *
 * Also surfaces recovery advisories for manual operator review.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Shield,
  TrendingUp,
} from 'lucide-react';
import {
  useOperatorPredictions,
  riskColor,
  riskBadgeVariant,
  type Prediction,
  type RecoveryAdvisory,
  type RiskLevel,
} from '@/hooks/useOperatorPredictions';

const categoryMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  queue_saturation:          { label: 'Queue Saturation',       icon: <Activity className="h-4 w-4" />,        color: 'text-orange-400' },
  deployment_instability:    { label: 'Deployment Instability', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-400' },
  observability_blind_spot:  { label: 'Observability Gap',      icon: <Shield className="h-4 w-4" />,         color: 'text-yellow-400' },
  runtime_degradation:       { label: 'Runtime Degradation',    icon: <TrendingUp className="h-4 w-4" />,    color: 'text-purple-400' },
};

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const [expanded, setExpanded] = useState(false);
  const meta = categoryMeta[prediction.category] ?? { label: prediction.category, icon: <Brain className="h-4 w-4" />, color: 'text-muted-foreground' };

  const likelihoodPct = Math.round(prediction.likelihood * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={meta.color}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-sm">{meta.label}</span>
            <Badge
              variant={riskBadgeVariant(prediction.risk as RiskLevel)}
              className="text-[10px] px-1.5 py-0"
            >
              {prediction.risk}
            </Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {likelihoodPct}% likelihood
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{prediction.description}</p>
        </div>
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator />
            <div className="p-4 space-y-3 bg-muted/20">
              {/* Watch surfaces */}
              {prediction.watchSurfaces?.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Watch Surfaces</p>
                  <div className="flex flex-wrap gap-1">
                    {prediction.watchSurfaces.map((surface) => (
                      <Badge key={surface} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                        {surface}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Guidance */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Operational Guidance</p>
                <p className="text-xs text-foreground leading-relaxed">{prediction.guidance}</p>
              </div>
              {/* Timestamp */}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(prediction.timestamp).toLocaleString()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AdvisoryCard({ advisory }: { advisory: RecoveryAdvisory }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg overflow-hidden"
    >
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <Shield className={`h-4 w-4 ${riskColor(advisory.severity as RiskLevel)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-sm">{advisory.type}</span>
            <Badge
              variant={riskBadgeVariant(advisory.severity as RiskLevel)}
              className="text-[10px] px-1.5 py-0"
            >
              {advisory.severity}
            </Badge>
            {advisory.manualReviewRequired && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                manual review
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{advisory.recommendation}</p>
        </div>
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator />
            <div className="p-4 space-y-2 bg-muted/20">
              <p className="text-xs leading-relaxed">{advisory.recommendation}</p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(advisory.timestamp).toLocaleString()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PredictionDashboardPanel() {
  const { predictions, advisories, isLoading, error, lastRefreshed } = useOperatorPredictions();

  const criticalCount = predictions.filter((p) => p.risk === 'critical').length;
  const highCount = predictions.filter((p) => p.risk === 'high').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">Operational Predictions</h3>
            <p className="text-xs text-muted-foreground">
              Predictive cognition — advisory only, no autonomous action
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-[10px] text-muted-foreground">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/30">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-orange-500">{highCount}</p>
            <p className="text-xs text-muted-foreground">High Risk</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-blue-500">{predictions.length}</p>
            <p className="text-xs text-muted-foreground">Total Predictions</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-purple-500">{advisories.length}</p>
            <p className="text-xs text-muted-foreground">Advisories</p>
          </CardContent>
        </Card>
      </div>

      {/* No predictions yet */}
      {!isLoading && predictions.length === 0 && advisories.length === 0 && !error && (
        <Card>
          <CardContent className="py-10 text-center">
            <Brain className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <h4 className="font-medium mb-1">Prediction engine warming up</h4>
            <p className="text-sm text-muted-foreground">
              No predictions yet — the engine is still building its first snapshot.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Predictions list */}
      {predictions.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            Active Predictions ({predictions.length})
          </p>
          <ScrollArea className="h-[320px]">
            <div className="space-y-2 pr-3">
              <AnimatePresence>
                {predictions.map((p) => (
                  <PredictionCard key={p.id} prediction={p} />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Recovery advisories */}
      {advisories.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            Recovery Advisories ({advisories.length})
          </p>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2 pr-3">
              <AnimatePresence>
                {advisories.map((a) => (
                  <AdvisoryCard key={a.id} advisory={a} />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Advisory boundary notice */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
        <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This panel displays advisory cognition only — no infrastructure is mutated, no services are restarted,
          no changes are deployed. All recovery actions require manual operator review.
        </p>
      </div>
    </div>
  );
}