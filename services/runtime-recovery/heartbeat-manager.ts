import {
  ExecutionEnvelope,
  RuntimeClock,
  systemClock,
} from './execution-envelope';

const DEFAULT_LEASE_SECONDS = 60;

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
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
