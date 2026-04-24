// Pure helpers for aws-eks-deploy-v2.
//
// Kept in a separate module from index.ts so unit tests can import them
// WITHOUT triggering serve() (which would try to bind a port).
// index.ts re-exports these for backward-compatible imports.

import { z } from "https://esm.sh/zod@3.23.8"

// ────────────────────────────────────────────────────────────────────────────
// Request schema
// ────────────────────────────────────────────────────────────────────────────
export const ALLOWED_OPERATIONS = [
  'deploy',
  'create-cluster',
  'validate',
  'status',
  'get-status',
  'describe-cluster',
  'list-clusters',
  'delete',
  'delete-cluster',
] as const

export const RequestSchema = z.object({
  operation: z.enum(ALLOWED_OPERATIONS).optional(),
  clusterName: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9-]{0,99}$/, 'must start with a letter and be ≤100 chars (letters, digits, dashes)')
    .optional(),
  region: z
    .string()
    .regex(/^[a-z]{2}-[a-z]+-\d$/, 'must look like an AWS region, e.g. us-east-1')
    .optional(),
  nodeCount: z.number().int().min(1).max(100).optional(),
  instanceType: z.string().min(1).max(64).optional(),
  config: z.record(z.unknown()).optional(),
  dryRun: z.boolean().optional(),
})

export type DeploymentRequest = z.infer<typeof RequestSchema>

export function validateRequest(body: unknown):
  | { ok: true; data: DeploymentRequest }
  | { ok: false; errors: string[] } {
  const parsed = RequestSchema.safeParse(body)
  if (parsed.success) return { ok: true, data: parsed.data }
  const errors = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
  return { ok: false, errors }
}

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

export function getPlannedActions(body: DeploymentRequest): PlannedAction[] {
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
export function getDryRunDiff(body: DeploymentRequest, planned: PlannedAction[]) {
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
  body: Pick<DeploymentRequest, 'operation' | 'dryRun'>,
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

// Idempotency expiry — TTL clamped to a sane range so a misconfigured TTL
// can never produce expiries in the past or absurdly far in the future.
export const IDEMPOTENCY_MIN_TTL_MS = 60 * 1000
export const IDEMPOTENCY_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const IDEMPOTENCY_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export function buildIdempotencyExpiry(now: number, ttlMs: number): string {
  const requested = Number.isFinite(ttlMs) ? Math.floor(ttlMs) : IDEMPOTENCY_DEFAULT_TTL_MS
  const safeTtl = Math.min(IDEMPOTENCY_MAX_TTL_MS, Math.max(IDEMPOTENCY_MIN_TTL_MS, requested))
  return new Date(now + safeTtl).toISOString()
}
