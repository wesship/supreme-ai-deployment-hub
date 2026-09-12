import { supabase } from '@/integrations/supabase/client';

export type ProviderQuality = {
  samples: number;
  pass_rate: number;
  revise_rate: number;
  block_rate: number;
  mean_confidence: number | null;
};

export type ProviderIntelligence = {
  provider: string;
  jobs: number;
  completed: number;
  failed: number;
  failureRate: number;
  regenerations: number;
  regenerationRate: number;
  meanLatencySeconds: number | null;
  reportedCostUsdTotal: number | null;
  reportedCostSamples: number;
  reportedCostCoverageRate: number;
  reportedCostPerApprovedShot: number | null;
  approvedShots: number;
  styles: string[];
  quality: ProviderQuality;
  routingAdjustment: number;
  passRateDelta: number | null;
  failureRateDelta: number | null;
  costPerApprovedShotDelta: number | null;
};

export type ProviderIntelligenceSnapshot = {
  windowDays: 7 | 30 | 90;
  currentWindowStart: string;
  previousWindowStart: string;
  sampledJobs: number;
  previousSampledJobs: number;
  providers: ProviderIntelligence[];
  stylePerformance: Array<{ key: string } & ProviderQuality>;
};

const asObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const secondsBetween = (started: unknown, completed: unknown): number | null => {
  if (!started || !completed) return null;
  const start = Date.parse(String(started));
  const end = Date.parse(String(completed));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / 1000);
};

const reportedCost = (metadata: Record<string, any>): number | null => {
  for (const key of ['cost_usd', 'cost', 'estimated_cost']) {
    const value = toNumber(metadata[key]);
    if (value !== null) return Math.max(0, value);
  }
  const billing = asObject(metadata.billing);
  for (const key of ['cost_usd', 'cost', 'amount_usd']) {
    const value = toNumber(billing[key]);
    if (value !== null) return Math.max(0, value);
  }
  return null;
};

const qualitySummary = (rows: any[]) => {
  const buckets = new Map<string, { samples: number; passes: number; revises: number; blocks: number; confidence: number[] }>();
  const touch = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, { samples: 0, passes: 0, revises: 0, blocks: 0, confidence: [] });
    return buckets.get(key)!;
  };
  rows.forEach((row) => {
    const provider = String(row.provider || '').trim().toLowerCase();
    if (!provider) return;
    const quality = asObject(row.quality_metadata);
    const decision = String(quality.decision || '').toLowerCase();
    if (!['pass', 'revise', 'block'].includes(decision)) return;
    const visual = asObject(row.visual_context);
    const style = String(visual.style_id || '').trim();
    [provider, ...(style ? [`${provider}|${style}`] : [])].forEach((key) => {
      const bucket = touch(key);
      bucket.samples += 1;
      if (decision === 'pass') bucket.passes += 1;
      if (decision === 'revise') bucket.revises += 1;
      if (decision === 'block') bucket.blocks += 1;
      const confidence = toNumber(quality.confidence);
      if (confidence !== null) bucket.confidence.push(Math.max(0, Math.min(1, confidence)));
    });
  });
  return new Map([...buckets.entries()].map(([key, bucket]) => [key, {
    samples: bucket.samples,
    pass_rate: bucket.samples ? bucket.passes / bucket.samples : 0,
    revise_rate: bucket.samples ? bucket.revises / bucket.samples : 0,
    block_rate: bucket.samples ? bucket.blocks / bucket.samples : 0,
    mean_confidence: bucket.confidence.length ? bucket.confidence.reduce((a, b) => a + b, 0) / bucket.confidence.length : null,
  }]));
};

const routingAdjustment = (quality: ProviderQuality): number => {
  if (quality.samples < 3) return 0;
  const confidence = quality.mean_confidence ?? 0.5;
  const raw = Math.round((quality.pass_rate - 0.5) * 20 + (confidence - 0.5) * 8 - quality.block_rate * 8);
  return Math.max(-15, Math.min(15, raw));
};

const splitProviders = (rows: any[]) => {
  const providers = new Map<string, any[]>();
  rows.forEach((row: any) => {
    const provider = String(row.provider || 'unknown').toLowerCase();
    if (!providers.has(provider)) providers.set(provider, []);
    providers.get(provider)!.push(row);
  });
  return providers;
};

const providerPeriodStats = (rows: any[]) => {
  const quality = qualitySummary(rows);
  const providers = splitProviders(rows);
  const stats = new Map<string, { failureRate: number; passRate: number; costPerApprovedShot: number | null }>();
  providers.forEach((providerRows, provider) => {
    const failed = providerRows.filter((row) => ['failed', 'error'].includes(String(row.status || '').toLowerCase())).length;
    const providerQuality = quality.get(provider) || { samples: 0, pass_rate: 0, revise_rate: 0, block_rate: 0, mean_confidence: null };
    const approvedShots = providerRows.filter((row) => String(asObject(row.quality_metadata).decision || '').toLowerCase() === 'pass').length;
    const costs = providerRows.map((row) => reportedCost(asObject(row.cost_metadata))).filter((v): v is number => v !== null);
    const totalCost = costs.reduce((a, b) => a + b, 0);
    stats.set(provider, {
      failureRate: providerRows.length ? failed / providerRows.length : 0,
      passRate: providerQuality.pass_rate,
      costPerApprovedShot: costs.length && approvedShots > 0 ? totalCost / approvedShots : null,
    });
  });
  return stats;
};

const delta = (current: number | null, previous: number | null): number | null =>
  current === null || previous === null ? null : current - previous;

export const fetchProviderIntelligence = async (
  projectId?: string,
  windowDays: 7 | 30 | 90 = 30,
): Promise<ProviderIntelligenceSnapshot> => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in is required to view provider intelligence.');

  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const currentWindowStart = new Date(now - windowMs).toISOString();
  const previousWindowStart = new Date(now - windowMs * 2).toISOString();

  let query = (supabase as any)
    .from('ai_film_render_jobs')
    .select('id,project_id,provider,status,created_at,started_at,completed_at,cost_metadata,quality_metadata,visual_context,parent_job_id,regeneration_count')
    .eq('owner_id', authData.user.id)
    .eq('job_type', 'video')
    .gte('created_at', previousWindowStart)
    .order('created_at', { ascending: false })
    .limit(500);
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  const allRows = data || [];
  const currentRows = allRows.filter((row: any) => Date.parse(String(row.created_at || '')) >= Date.parse(currentWindowStart));
  const previousRows = allRows.filter((row: any) => {
    const created = Date.parse(String(row.created_at || ''));
    return created >= Date.parse(previousWindowStart) && created < Date.parse(currentWindowStart);
  });

  const quality = qualitySummary(currentRows);
  const previousStats = providerPeriodStats(previousRows);
  const providers = splitProviders(currentRows);

  const summaries: ProviderIntelligence[] = [...providers.entries()].map(([provider, providerRows]) => {
    const latencies = providerRows.map((row) => secondsBetween(row.started_at, row.completed_at)).filter((v): v is number => v !== null);
    const costs = providerRows.map((row) => reportedCost(asObject(row.cost_metadata))).filter((v): v is number => v !== null);
    const providerQuality = quality.get(provider) || { samples: 0, pass_rate: 0, revise_rate: 0, block_rate: 0, mean_confidence: null };
    const failed = providerRows.filter((row) => ['failed', 'error'].includes(String(row.status || '').toLowerCase())).length;
    const completed = providerRows.filter((row) => ['completed', 'succeeded'].includes(String(row.status || '').toLowerCase())).length;
    const regenerations = providerRows.filter((row) => row.parent_job_id || Number(row.regeneration_count || 0) > 0).length;
    const approvedShots = providerRows.filter((row) => String(asObject(row.quality_metadata).decision || '').toLowerCase() === 'pass').length;
    const styles = [...new Set(providerRows.map((row) => String(asObject(row.visual_context).style_id || '').trim()).filter(Boolean))];
    const totalCost = costs.reduce((a, b) => a + b, 0);
    const currentCostPerApprovedShot = costs.length && approvedShots > 0 ? totalCost / approvedShots : null;
    const previous = previousStats.get(provider);
    const currentFailureRate = providerRows.length ? failed / providerRows.length : 0;
    return {
      provider,
      jobs: providerRows.length,
      completed,
      failed,
      failureRate: currentFailureRate,
      regenerations,
      regenerationRate: providerRows.length ? regenerations / providerRows.length : 0,
      meanLatencySeconds: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
      reportedCostUsdTotal: costs.length ? totalCost : null,
      reportedCostSamples: costs.length,
      reportedCostCoverageRate: providerRows.length ? costs.length / providerRows.length : 0,
      reportedCostPerApprovedShot: currentCostPerApprovedShot,
      approvedShots,
      styles,
      quality: providerQuality,
      routingAdjustment: routingAdjustment(providerQuality),
      passRateDelta: previous ? providerQuality.pass_rate - previous.passRate : null,
      failureRateDelta: previous ? currentFailureRate - previous.failureRate : null,
      costPerApprovedShotDelta: previous ? delta(currentCostPerApprovedShot, previous.costPerApprovedShot) : null,
    };
  }).sort((a, b) => b.routingAdjustment - a.routingAdjustment || b.quality.pass_rate - a.quality.pass_rate);

  const stylePerformance = [...quality.entries()]
    .filter(([key]) => key.includes('|'))
    .map(([key, value]) => ({ key, ...value }));

  return {
    windowDays,
    currentWindowStart,
    previousWindowStart,
    sampledJobs: currentRows.length,
    previousSampledJobs: previousRows.length,
    providers: summaries,
    stylePerformance,
  };
};
