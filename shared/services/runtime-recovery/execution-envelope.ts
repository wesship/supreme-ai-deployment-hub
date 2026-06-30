export type ExecutionStatus =
  | 'PENDING'
  | 'LOCKED'
  | 'RUNNING'
  | 'RETRY'
  | 'PAUSED'
  | 'MANUAL_REVIEW'
  | 'ESCALATED'
  | 'FAILED'
  | 'COMPLETED'
  | 'STALE'
  | 'QUARANTINED'
  | 'DLQ';

export interface ExecutionEnvelope {
  task_id: string;
  execution_id: string;
  correlation_id: string;
  lineage_id: string;
  idempotency_key: string;
  status: ExecutionStatus;
  retry_count: number;
  max_retries: number;
  scheduler_owner: string | null;
  worker_owner: string | null;
  lease_expires_at: string | null;
  last_heartbeat_at: string | null;
  replay_hash?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RuntimeClock {
  now(): Date;
}

export const systemClock: RuntimeClock = {
  now: () => new Date(),
};

export function createExecutionEnvelope(input: {
  task_id: string;
  execution_id: string;
  correlation_id: string;
  lineage_id: string;
  idempotency_key: string;
  max_retries?: number;
  scheduler_owner?: string | null;
  clock?: RuntimeClock;
}): ExecutionEnvelope {
  const clock = input.clock ?? systemClock;
  const now = clock.now().toISOString();

  return {
    task_id: input.task_id,
    execution_id: input.execution_id,
    correlation_id: input.correlation_id,
    lineage_id: input.lineage_id,
    idempotency_key: input.idempotency_key,
    status: 'PENDING',
    retry_count: 0,
    max_retries: input.max_retries ?? 3,
    scheduler_owner: input.scheduler_owner ?? null,
    worker_owner: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
    replay_hash: null,
    failure_reason: null,
    created_at: now,
    updated_at: now,
  };
}

export function isTerminalStatus(status: ExecutionStatus): boolean {
  return ['FAILED', 'COMPLETED', 'QUARANTINED', 'DLQ'].includes(status);
}
