import { ExecutionEnvelope, RuntimeClock, systemClock } from './execution-envelope';

export interface CompletedExecutionRecord {
  idempotency_key: string;
  execution_id: string;
  lineage_id: string;
  replay_hash?: string | null;
  completed_at: string;
}

export interface ReplaySafetyResult {
  safe: boolean;
  reason: string;
  action: 'ALLOW_RETRY' | 'REJECT_DUPLICATE' | 'ESCALATE_REVIEW';
}

export function buildReplayHash(input: {
  task_id: string;
  execution_id: string;
  lineage_id: string;
  idempotency_key: string;
}): string {
  return [
    input.task_id,
    input.execution_id,
    input.lineage_id,
    input.idempotency_key,
  ].join(':');
}

export function hasDuplicateCompletion(
  envelope: ExecutionEnvelope,
  completed: CompletedExecutionRecord[],
): boolean {
  return completed.some(
    (record) => record.idempotency_key === envelope.idempotency_key,
  );
}

export function validateReplaySafety(
  envelope: ExecutionEnvelope,
  completed: CompletedExecutionRecord[],
): ReplaySafetyResult {
  const duplicate = completed.find(
    (record) => record.idempotency_key === envelope.idempotency_key,
  );

  if (duplicate) {
    return {
      safe: false,
      reason: `duplicate completion exists for idempotency_key=${envelope.idempotency_key}`,
      action: 'REJECT_DUPLICATE',
    };
  }

  if (!envelope.lineage_id || !envelope.correlation_id || !envelope.execution_id) {
    return {
      safe: false,
      reason: 'missing lineage, correlation, or execution metadata',
      action: 'ESCALATE_REVIEW',
    };
  }

  if (envelope.replay_hash) {
    const expected = buildReplayHash(envelope);
    if (envelope.replay_hash !== expected) {
      return {
        safe: false,
        reason: 'replay hash mismatch',
        action: 'ESCALATE_REVIEW',
      };
    }
  }

  return {
    safe: true,
    reason: 'replay safety checks passed',
    action: 'ALLOW_RETRY',
  };
}

export function attachReplayHash(envelope: ExecutionEnvelope): ExecutionEnvelope {
  return {
    ...envelope,
    replay_hash: buildReplayHash(envelope),
  };
}

export function escalateUnsafeReplay(
  envelope: ExecutionEnvelope,
  reason: string,
  clock: RuntimeClock = systemClock,
): ExecutionEnvelope {
  return {
    ...envelope,
    status: 'ESCALATED',
    failure_reason: reason,
    updated_at: clock.now().toISOString(),
  };
}
