import {
  ExecutionEnvelope,
  RuntimeClock,
  systemClock,
} from './execution-envelope';
import {
  RuntimeTelemetrySink,
  emitRuntimeEvent,
} from './telemetry';

const DEFAULT_LEASE_SECONDS = 60;

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export interface RuntimeLifecycleOptions {
  telemetry?: RuntimeTelemetrySink;
  deployment_version?: string;
  clock?: RuntimeClock;
  leaseSeconds?: number;
}

export function claimExecution(
  envelope: ExecutionEnvelope,
  workerOwner: string,
  clock: RuntimeClock = systemClock,
  leaseSeconds = DEFAULT_LEASE_SECONDS,
): ExecutionEnvelope {
  const now = clock.now();

  return {
    ...envelope,
    status: 'LOCKED',
    worker_owner: workerOwner,
    last_heartbeat_at: now.toISOString(),
    lease_expires_at: addSeconds(now, leaseSeconds).toISOString(),
    updated_at: now.toISOString(),
  };
}

export async function claimExecutionWithTelemetry(
  envelope: ExecutionEnvelope,
  workerOwner: string,
  options: RuntimeLifecycleOptions = {},
): Promise<ExecutionEnvelope> {
  const next = claimExecution(
    envelope,
    workerOwner,
    options.clock ?? systemClock,
    options.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  );

  if (options.telemetry) {
    await emitRuntimeEvent({
      sink: options.telemetry,
      event_type: 'TASK_CLAIMED',
      envelope: next,
      deployment_version: options.deployment_version,
      clock: options.clock,
      metadata: { workerOwner },
    });
  }

  return next;
}

export function beginExecution(
  envelope: ExecutionEnvelope,
  clock: RuntimeClock = systemClock,
): ExecutionEnvelope {
  return {
    ...envelope,
    status: 'RUNNING',
    updated_at: clock.now().toISOString(),
  };
}

export async function beginExecutionWithTelemetry(
  envelope: ExecutionEnvelope,
  options: RuntimeLifecycleOptions = {},
): Promise<ExecutionEnvelope> {
  const next = beginExecution(envelope, options.clock ?? systemClock);

  if (options.telemetry) {
    await emitRuntimeEvent({
      sink: options.telemetry,
      event_type: 'EXECUTION_STARTED',
      envelope: next,
      deployment_version: options.deployment_version,
      clock: options.clock,
    });
  }

  return next;
}

export function heartbeatExecution(
  envelope: ExecutionEnvelope,
  clock: RuntimeClock = systemClock,
  leaseSeconds = DEFAULT_LEASE_SECONDS,
): ExecutionEnvelope {
  const now = clock.now();

  return {
    ...envelope,
    last_heartbeat_at: now.toISOString(),
    lease_expires_at: addSeconds(now, leaseSeconds).toISOString(),
    updated_at: now.toISOString(),
  };
}

export async function heartbeatExecutionWithTelemetry(
  envelope: ExecutionEnvelope,
  options: RuntimeLifecycleOptions = {},
): Promise<ExecutionEnvelope> {
  const next = heartbeatExecution(
    envelope,
    options.clock ?? systemClock,
    options.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  );

  if (options.telemetry) {
    await emitRuntimeEvent({
      sink: options.telemetry,
      event_type: 'HEARTBEAT_RENEWED',
      envelope: next,
      deployment_version: options.deployment_version,
      clock: options.clock,
    });
  }

  return next;
}

export function isExecutionStale(
  envelope: ExecutionEnvelope,
  clock: RuntimeClock = systemClock,
): boolean {
  if (!envelope.lease_expires_at) {
    return false;
  }

  return new Date(envelope.lease_expires_at).getTime() < clock.now().getTime();
}

export function markExecutionStale(
  envelope: ExecutionEnvelope,
  reason = 'heartbeat expired',
  clock: RuntimeClock = systemClock,
): ExecutionEnvelope {
  return {
    ...envelope,
    status: 'STALE',
    failure_reason: reason,
    updated_at: clock.now().toISOString(),
  };
}

export async function markExecutionStaleWithTelemetry(
  envelope: ExecutionEnvelope,
  reason = 'heartbeat expired',
  options: RuntimeLifecycleOptions = {},
): Promise<ExecutionEnvelope> {
  const next = markExecutionStale(envelope, reason, options.clock ?? systemClock);

  if (options.telemetry) {
    await emitRuntimeEvent({
      sink: options.telemetry,
      event_type: 'STALE_DETECTED',
      envelope: next,
      deployment_version: options.deployment_version,
      clock: options.clock,
      metadata: { reason },
    });
  }

  return next;
}

export function retryExecution(
  envelope: ExecutionEnvelope,
  clock: RuntimeClock = systemClock,
): ExecutionEnvelope {
  const nextRetry = envelope.retry_count + 1;

  if (nextRetry >= envelope.max_retries) {
    return {
      ...envelope,
      status: 'DLQ',
      retry_count: nextRetry,
      updated_at: clock.now().toISOString(),
    };
  }

  return {
    ...envelope,
    status: 'RETRY',
    retry_count: nextRetry,
    updated_at: clock.now().toISOString(),
  };
}

export async function retryExecutionWithTelemetry(
  envelope: ExecutionEnvelope,
  options: RuntimeLifecycleOptions = {},
): Promise<ExecutionEnvelope> {
  const next = retryExecution(envelope, options.clock ?? systemClock);

  if (options.telemetry) {
    await emitRuntimeEvent({
      sink: options.telemetry,
      event_type: next.status === 'DLQ' ? 'DLQ_ROUTED' : 'RETRY_SCHEDULED',
      envelope: next,
      deployment_version: options.deployment_version,
      clock: options.clock,
      metadata: {
        retry_count: next.retry_count,
        max_retries: next.max_retries,
      },
    });
  }

  return next;
}
