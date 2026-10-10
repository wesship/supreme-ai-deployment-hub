import { describe, expect, it } from 'vitest';

import { createExecutionEnvelope, RuntimeClock } from './execution-envelope';
import {
  beginExecutionWithTelemetry,
  claimExecutionWithTelemetry,
  isExecutionStale,
  markExecutionStaleWithTelemetry,
  retryExecutionWithTelemetry,
} from './heartbeat-manager';
import { attachReplayHash, validateReplaySafety } from './replay-safety';
import { InMemoryTelemetrySink } from './telemetry';

function fixedClock(iso: string): RuntimeClock {
  return { now: () => new Date(iso) };
}

describe('runtime recovery drill', () => {
  it('detects worker crash, marks stale, retries safely, and emits lineage telemetry', async () => {
    const telemetry = new InMemoryTelemetrySink();

    const envelope = attachReplayHash(
      createExecutionEnvelope({
        task_id: 'task-1',
        execution_id: 'exec-1',
        correlation_id: 'corr-1',
        lineage_id: 'lineage-1',
        idempotency_key: 'task-1:lineage-1',
        scheduler_owner: 'scheduler-a',
        max_retries: 3,
        clock: fixedClock('2026-05-24T00:00:00.000Z'),
      }),
    );

    const claimed = await claimExecutionWithTelemetry(envelope, 'worker-a', {
      telemetry,
      deployment_version: 'test-deploy',
      clock: fixedClock('2026-05-24T00:00:01.000Z'),
      leaseSeconds: 30,
    });

    const running = await beginExecutionWithTelemetry(claimed, {
      telemetry,
      deployment_version: 'test-deploy',
      clock: fixedClock('2026-05-24T00:00:02.000Z'),
    });

    expect(running.status).toBe('RUNNING');
    expect(isExecutionStale(running, fixedClock('2026-05-24T00:00:10.000Z'))).toBe(false);
    expect(isExecutionStale(running, fixedClock('2026-05-24T00:00:40.000Z'))).toBe(true);

    const stale = await markExecutionStaleWithTelemetry(running, 'worker heartbeat expired', {
      telemetry,
      deployment_version: 'test-deploy',
      clock: fixedClock('2026-05-24T00:00:40.000Z'),
    });

    expect(stale.status).toBe('STALE');
    expect(stale.lineage_id).toBe('lineage-1');

    const replaySafety = validateReplaySafety(stale, []);
    expect(replaySafety.safe).toBe(true);
    expect(replaySafety.action).toBe('ALLOW_RETRY');

    const retry = await retryExecutionWithTelemetry(stale, {
      telemetry,
      deployment_version: 'test-deploy',
      clock: fixedClock('2026-05-24T00:00:41.000Z'),
    });

    expect(retry.status).toBe('RETRY');
    expect(retry.retry_count).toBe(1);

    expect(telemetry.events.map((event) => event.event_type)).toEqual([
      'TASK_CLAIMED',
      'EXECUTION_STARTED',
      'STALE_DETECTED',
      'RETRY_SCHEDULED',
    ]);

    for (const event of telemetry.events) {
      expect(event.execution_id).toBe('exec-1');
      expect(event.correlation_id).toBe('corr-1');
      expect(event.lineage_id).toBe('lineage-1');
      expect(event.deployment_version).toBe('test-deploy');
    }
  });

  it('routes to DLQ when retry ceiling is exceeded', async () => {
    const telemetry = new InMemoryTelemetrySink();
    const envelope = createExecutionEnvelope({
      task_id: 'task-dlq',
      execution_id: 'exec-dlq',
      correlation_id: 'corr-dlq',
      lineage_id: 'lineage-dlq',
      idempotency_key: 'task-dlq:lineage-dlq',
      max_retries: 1,
      clock: fixedClock('2026-05-24T00:00:00.000Z'),
    });

    const dlq = await retryExecutionWithTelemetry(envelope, {
      telemetry,
      deployment_version: 'test-deploy',
      clock: fixedClock('2026-05-24T00:00:01.000Z'),
    });

    expect(dlq.status).toBe('DLQ');
    expect(telemetry.events[0].event_type).toBe('DLQ_ROUTED');
  });
});
