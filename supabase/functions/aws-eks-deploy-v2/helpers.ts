// Pure helpers for aws-eks-deploy-v2.
//
// Kept in a separate module from index.ts so unit tests can import them
// WITHOUT triggering serve() (which would try to bind a port).
// index.ts re-imports these so production behavior stays identical.

// ────────────────────────────────────────────────────────────────────────────
// Planned actions
// ────────────────────────────────────────────────────────────────────────────
export type PlannedAction = {
  id: string
  title: string
  type: 'read' | 'write' | 'delete'
  risk: 'low' | 'medium' | 'high'
  requiresAuth: boolean
  mutatesAws: boolean
}

// Minimal request shape these helpers care about. Kept local so we don't
// have to import the full Zod schema (which lives in index.ts).
export type PlanInput = {
  operation?: string
  dryRun?: boolean
  clusterName?: string
  region?: string
  nodeCount?: number
  instanceType?: string
  config?: unknown
}

const A = {
  read: (id: string, title: string, risk: PlannedAction['risk'] = 'low'): PlannedAction => ({
    id, title, type: 'read', risk, requiresAuth: true, mutatesAws: false,
  }),
  write: (id: string, title: string, risk: PlannedAction['risk'] = 'medium'): PlannedAction => ({
    id, title, type: 'write', risk, requiresAuth: true, mutatesAws: true,
  }),
  del: (id: string, title: string, risk: PlannedAction['risk'] = 'high'): PlannedAction => ({
    id, title, type: 'delete', risk, requiresAuth: true, mutatesAws: true,
  }),
  noop: (id: string, title: string): PlannedAction => ({
    id, title, type: 'read', risk: 'low', requiresAuth: false, mutatesAws: false,
  }),
}

export function getPlannedActions(body: PlanInput): PlannedAction[] {
  const op = String(body.operation ?? 'deploy')

  if (op === 'validate') {
    return [
      A.read('validate.creds', 'Validate AWS credentials'),
      A.read('validate.region', 'Validate region'),
      A.read('validate.cluster', 'Check EKS cluster visibility'),
      A.noop('validate.noop', 'No AWS resources changed'),
    ]
  }

  if (op === 'deploy' || op === 'create-cluster') {
    return [
      A.read('deploy.creds', 'Validate AWS credentials'),
      A.read('deploy.vpc', 'Discover VPC and subnets'),
      A.read('deploy.iam', 'Validate IAM role'),
      A.write('deploy.cluster', 'Create or update EKS cluster', 'high'),
      A.write('deploy.nodegroup', 'Configure node group', 'medium'),
      A.read('deploy.status', 'Return deployment status'),
    ]
  }

  if (op === 'status' || op === 'get-status' || op === 'describe-cluster') {
    return [
      A.read('status.creds', 'Validate AWS credentials'),
      A.read('status.describe', 'Describe EKS cluster'),
      A.noop('status.noop', 'No AWS resources changed'),
    ]
  }

  if (op === 'list-clusters') {
    return [
      A.read('list.creds', 'Validate AWS credentials'),
      A.read('list.clusters', 'List EKS clusters in region'),
      A.noop('list.noop', 'No AWS resources changed'),
    ]
  }

  if (op === 'delete' || op === 'delete-cluster') {
    return [
      A.read('delete.creds', 'Validate AWS credentials'),
      A.read('delete.locate', 'Locate target EKS cluster'),
      A.del('delete.cluster', 'Initiate cluster deletion', 'high'),
      A.read('delete.status', 'Return deletion status'),
    ]
  }

  return [
    A.noop('unknown.validate', 'Validate request'),
    A.noop('unknown.noop', 'No AWS resources changed'),
  ]
}

// Dry-run diff report — current state is "unknown" without AWS calls; the
// desired state echoes the validated payload, and `changes` lists the
// operations the real run would perform.
export function getDryRunDiff<T extends PlanInput>(body: T, planned: PlannedAction[]) {
  return {
    current: 'unknown' as const,
    desired: body,
    changes: planned,
    summary: {
      total: planned.length,
      mutating: planned.filter((a) => a.mutatesAws).length,
      highRisk: planned.filter((a) => a.risk === 'high').length,
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Standardized metrics schema — STABLE contract for dashboards + CI.
// ────────────────────────────────────────────────────────────────────────────
export type Metrics = {
  durationMs: number
  operation: string
  dryRun: boolean
  plannedActionsCount: number
  mutatingCount: number
  highRiskCount: number
}

export function buildMetrics(
  body: Pick<PlanInput, 'operation' | 'dryRun'>,
  planned: PlannedAction[],
  durationMs: number,
): Metrics {
  return {
    durationMs,
    operation: String(body.operation ?? 'deploy'),
    dryRun: body.dryRun === true,
    plannedActionsCount: planned.length,
    mutatingCount: planned.filter((a) => a.mutatesAws).length,
    highRiskCount: planned.filter((a) => a.risk === 'high').length,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Idempotency expiry — TTL clamped to a sane range so a misconfigured TTL
// can never produce expiries in the past or absurdly far in the future.
// ────────────────────────────────────────────────────────────────────────────
export const IDEMPOTENCY_MIN_TTL_MS = 60 * 1000
export const IDEMPOTENCY_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const IDEMPOTENCY_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export function buildIdempotencyExpiry(now: number, ttlMs: number): string {
  const requested = Number.isFinite(ttlMs) ? Math.floor(ttlMs) : IDEMPOTENCY_DEFAULT_TTL_MS
  const safeTtl = Math.min(IDEMPOTENCY_MAX_TTL_MS, Math.max(IDEMPOTENCY_MIN_TTL_MS, requested))
  return new Date(now + safeTtl).toISOString()
}
