/**
 * useOperatorPredictions.ts — Operator prediction + advisory cognition hook
 *
 * Fetches live predictive cognition from:
 *   GET /api/operator/predictions
 *   GET /api/operator/recovery-advisories
 *
 * Polling interval: 60 seconds (operational cognition cadence)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { env } from '@/lib/env';

export type RiskLevel = 'critical' | 'high' | 'moderate' | 'low' | 'info';
export type PredictionCategory =
  | 'queue_saturation'
  | 'deployment_instability'
  | 'observability_blind_spot'
  | 'runtime_degradation';

export interface Prediction {
  id: string;
  category: PredictionCategory;
  risk: RiskLevel;
  likelihood: number; // 0-1
  description: string;
  watchSurfaces: string[];
  guidance: string;
  timestamp: string;
}

export interface RecoveryAdvisory {
  id: string;
  type: string;
  severity: RiskLevel;
  recommendation: string;
  manualReviewRequired: boolean;
  timestamp: string;
}

interface PredictionsState {
  predictions: Prediction[];
  advisories: RecoveryAdvisory[];
  isLoading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
}

const POLL_INTERVAL_MS = 60_000; // 60 seconds — operational cognition cadence
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchJSON<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export function useOperatorPredictions(enabled = true): PredictionsState {
  const [state, setState] = useState<PredictionsState>({
    predictions: [],
    advisories: [],
    isLoading: false,
    error: null,
    lastRefreshed: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const base = env.apiUrl;

      const [predictionsData, advisoriesData] = await Promise.allSettled([
        fetchJSON<{ predictions?: Prediction[]; data?: Prediction[] }>(`${base}/api/operator/predictions`),
        fetchJSON<{ advisories?: RecoveryAdvisory[]; data?: RecoveryAdvisory[] }>(`${base}/api/operator/recovery-advisories`),
      ]);

      const predictions: Prediction[] = [];
      const advisories: RecoveryAdvisory[] = [];

      if (predictionsData.status === 'fulfilled') {
        const pd = predictionsData.value;
        predictions.push(...(pd.predictions ?? pd.data ?? []));
      }

      if (advisoriesData.status === 'fulfilled') {
        const ad = advisoriesData.value;
        advisories.push(...(ad.advisories ?? ad.data ?? []));
      }

      setState({
        predictions,
        advisories,
        isLoading: false,
        error: null,
        lastRefreshed: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, refresh]);

  return state;
}

export function riskColor(risk: RiskLevel): string {
  switch (risk) {
    case 'critical': return 'text-red-500';
    case 'high':     return 'text-orange-500';
    case 'moderate': return 'text-yellow-500';
    case 'low':      return 'text-blue-500';
    case 'info':     return 'text-muted-foreground';
    default:         return 'text-muted-foreground';
  }
}

export function riskBadgeVariant(risk: RiskLevel): 'destructive' | 'default' | 'secondary' | 'outline' {
  switch (risk) {
    case 'critical': return 'destructive';
    case 'high':     return 'destructive';
    case 'moderate': return 'default';
    case 'low':      return 'secondary';
    case 'info':     return 'outline';
    default:         return 'outline';
  }
}