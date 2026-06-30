import { RuntimeTelemetryEvent, RuntimeTelemetrySink } from './telemetry';

export interface RuntimeMetricSnapshot {
  execution_created_total: number;
  task_claimed_total: number;
  execution_started_total: number;
  heartbeat_renewed_total: number;
  execution_completed_total: number;
  retry_scheduled_total: number;
  stale_detected_total: number;
  dlq_routed_total: number;
  replay_rejected_total: number;
  escalation_triggered_total: number;
}

export class RuntimeMetricsCollector implements RuntimeTelemetrySink {
  private readonly counters: RuntimeMetricSnapshot = {
    execution_created_total: 0,
    task_claimed_total: 0,
    execution_started_total: 0,
    heartbeat_renewed_total: 0,
    execution_completed_total: 0,
    retry_scheduled_total: 0,
    stale_detected_total: 0,
    dlq_routed_total: 0,
    replay_rejected_total: 0,
    escalation_triggered_total: 0,
  };

  emit(event: RuntimeTelemetryEvent): void {
    switch (event.event_type) {
      case 'EXECUTION_CREATED':
        this.counters.execution_created_total += 1;
        break;
      case 'TASK_CLAIMED':
        this.counters.task_claimed_total += 1;
        break;
      case 'EXECUTION_STARTED':
        this.counters.execution_started_total += 1;
        break;
      case 'HEARTBEAT_RENEWED':
        this.counters.heartbeat_renewed_total += 1;
        break;
      case 'EXECUTION_COMPLETED':
        this.counters.execution_completed_total += 1;
        break;
      case 'RETRY_SCHEDULED':
        this.counters.retry_scheduled_total += 1;
        break;
      case 'STALE_DETECTED':
        this.counters.stale_detected_total += 1;
        break;
      case 'DLQ_ROUTED':
        this.counters.dlq_routed_total += 1;
        break;
      case 'REPLAY_REJECTED':
        this.counters.replay_rejected_total += 1;
        break;
      case 'ESCALATION_TRIGGERED':
        this.counters.escalation_triggered_total += 1;
        break;
    }
  }

  snapshot(): RuntimeMetricSnapshot {
    return { ...this.counters };
  }

  toPrometheusText(): string {
    return Object.entries(this.counters)
      .map(([name, value]) => `d3vonn_runtime_${name} ${value}`)
      .join('\n');
  }
}

export class CompositeTelemetrySink implements RuntimeTelemetrySink {
  constructor(private readonly sinks: RuntimeTelemetrySink[]) {}

  async emit(event: RuntimeTelemetryEvent): Promise<void> {
    await Promise.all(this.sinks.map((sink) => sink.emit(event)));
  }
}
