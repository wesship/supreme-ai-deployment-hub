import { RuntimeTelemetryEvent, RuntimeTelemetrySink } from './telemetry';

export interface RuntimeTraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  name: string;
  started_at: string;
  ended_at: string;
  attributes: Record<string, string | number | boolean | null>;
}

export interface RuntimeTraceExporter {
  export(span: RuntimeTraceSpan): void | Promise<void>;
}

export class InMemoryTraceExporter implements RuntimeTraceExporter {
  public readonly spans: RuntimeTraceSpan[] = [];

  export(span: RuntimeTraceSpan): void {
    this.spans.push(span);
  }
}

function stableId(parts: string[]): string {
  let hash = 0;
  const input = parts.join(':');
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function eventToTraceSpan(event: RuntimeTelemetryEvent): RuntimeTraceSpan {
  const traceId = stableId([event.correlation_id, event.lineage_id]);
  const spanId = stableId([event.execution_id, event.event_type, event.timestamp]);

  return {
    trace_id: traceId,
    span_id: spanId,
    parent_span_id: null,
    name: `runtime.${event.event_type.toLowerCase()}`,
    started_at: event.timestamp,
    ended_at: event.timestamp,
    attributes: {
      event_type: event.event_type,
      task_id: event.task_id,
      execution_id: event.execution_id,
      correlation_id: event.correlation_id,
      lineage_id: event.lineage_id,
      deployment_version: event.deployment_version,
      worker_owner: event.worker_owner,
      scheduler_owner: event.scheduler_owner,
      status: event.status,
    },
  };
}

export class RuntimeTracingSink implements RuntimeTelemetrySink {
  constructor(private readonly exporter: RuntimeTraceExporter) {}

  async emit(event: RuntimeTelemetryEvent): Promise<void> {
    await this.exporter.export(eventToTraceSpan(event));
  }
}
