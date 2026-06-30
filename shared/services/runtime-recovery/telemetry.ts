import { ExecutionEnvelope, RuntimeClock, systemClock } from './execution-envelope';

export type RuntimeTelemetryEventType =
  | 'EXECUTION_CREATED'
  | 'TASK_CLAIMED'
  | 'EXECUTION_STARTED'
  | 'HEARTBEAT_RENEWED'
  | 'EXECUTION_COMPLETED'
  | 'RETRY_SCHEDULED'
  | 'STALE_DETECTED'
  | 'DLQ_ROUTED'
  | 'REPLAY_REJECTED'
  | 'ESCALATION_TRIGGERED';

export interface RuntimeTelemetryEvent {
  event_type: RuntimeTelemetryEventType;
  task_id: string;
  execution_id: string;
  correlation_id: string;
  lineage_id: string;
  deployment_version: string;
  worker_owner: string | null;
  scheduler_owner: string | null;
  status: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeTelemetrySink {
  emit(event: RuntimeTelemetryEvent): void | Promise<void>;
}

export class InMemoryTelemetrySink implements RuntimeTelemetrySink {
  public readonly events: RuntimeTelemetryEvent[] = [];

  emit(event: RuntimeTelemetryEvent): void {
    this.events.push(event);
  }
}

export function buildRuntimeTelemetryEvent(input: {
  event_type: RuntimeTelemetryEventType;
  envelope: ExecutionEnvelope;
  deployment_version?: string;
  metadata?: Record<string, unknown>;
  clock?: RuntimeClock;
}): RuntimeTelemetryEvent {
  const clock = input.clock ?? systemClock;

  return {
    event_type: input.event_type,
    task_id: input.envelope.task_id,
    execution_id: input.envelope.execution_id,
    correlation_id: input.envelope.correlation_id,
    lineage_id: input.envelope.lineage_id,
    deployment_version: input.deployment_version ?? 'unknown',
    worker_owner: input.envelope.worker_owner,
    scheduler_owner: input.envelope.scheduler_owner,
    status: input.envelope.status,
    timestamp: clock.now().toISOString(),
    metadata: input.metadata,
  };
}

export async function emitRuntimeEvent(input: {
  sink: RuntimeTelemetrySink;
  event_type: RuntimeTelemetryEventType;
  envelope: ExecutionEnvelope;
  deployment_version?: string;
  metadata?: Record<string, unknown>;
  clock?: RuntimeClock;
}): Promise<RuntimeTelemetryEvent> {
  const event = buildRuntimeTelemetryEvent(input);
  await input.sink.emit(event);
  return event;
}
