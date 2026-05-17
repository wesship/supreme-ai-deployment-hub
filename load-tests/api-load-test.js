/**
 * api-load-test.js — Devonn.AI Production Load Test Suite
 *
 * Replaces the stub basic-load.js and basic-test.js with a comprehensive
 * k6 load test that covers:
 *   1. Smoke test    — 1 VU, 1 minute (verify the test works)
 *   2. Load test     — ramp to 50 VUs, 5 minutes (normal production load)
 *   3. Stress test   — ramp to 200 VUs, 10 minutes (find breaking point)
 *   4. Spike test    — instant spike to 500 VUs (test auto-scaling)
 *
 * Usage:
 *   k6 run --env BASE_URL=https://devonn.ai load-tests/api-load-test.js
 *   k6 run --env BASE_URL=http://localhost:8000 --env SCENARIO=smoke load-tests/api-load-test.js
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Custom Metrics ─────────────────────────────────────────────────────────────
const errorRate       = new Rate('error_rate');
const apiLatency      = new Trend('api_latency', true);
const healthCheckFail = new Counter('health_check_failures');

// ── Configuration ──────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const SCENARIO = __ENV.SCENARIO || 'load';

const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 20 },   // ramp up
      { duration: '5m', target: 50 },   // sustained load
      { duration: '2m', target: 20 },   // ramp down
      { duration: '1m', target: 0 },    // cool down
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '3m', target: 200 },
      { duration: '2m', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },   // baseline
      { duration: '30s', target: 500 },  // spike
      { duration: '1m',  target: 500 },  // sustain spike
      { duration: '30s', target: 10 },   // recover
      { duration: '30s', target: 0 },
    ],
  },
};

export const options = {
  scenarios: {
    [SCENARIO]: SCENARIOS[SCENARIO] || SCENARIOS.load,
  },
  thresholds: {
    // 95th percentile response time must be under 500ms
    'http_req_duration': ['p(95)<500'],
    // 99th percentile must be under 1500ms
    'http_req_duration{type:api}': ['p(99)<1500'],
    // Error rate must stay below 1%
    'error_rate': ['rate<0.01'],
    // Health check must never fail
    'health_check_failures': ['count<1'],
  },
};

// ── Helper: common headers ─────────────────────────────────────────────────────
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// ── Test Scenarios ─────────────────────────────────────────────────────────────
export default function () {

  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { type: 'health' } });
    const ok = check(res, {
      'health status is 200': (r) => r.status === 200,
      'health response has status ok': (r) => {
        try { return JSON.parse(r.body).status === 'ok'; }
        catch { return false; }
      },
    });
    if (!ok) healthCheckFail.add(1);
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('API — Public Endpoints', () => {
    // Test the root API endpoint
    const res = http.get(`${BASE_URL}/`, {
      headers,
      tags: { type: 'api' },
    });
    apiLatency.add(res.timings.duration);
    const ok = check(res, {
      'root endpoint responds': (r) => r.status < 500,
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

// ── Summary Report ─────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const errRate = data.metrics.error_rate?.values?.rate || 0;

  console.log('\n=== Devonn.AI Load Test Summary ===');
  console.log(`Scenario:       ${SCENARIO}`);
  console.log(`Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`p(95) Latency:  ${p95.toFixed(2)}ms (threshold: 500ms)`);
  console.log(`Error Rate:     ${(errRate * 100).toFixed(2)}% (threshold: 1%)`);
  console.log(`Status:         ${p95 < 500 && errRate < 0.01 ? '✅ PASS' : '❌ FAIL'}`);

  return {
    'test-results/load-test-summary.json': JSON.stringify(data, null, 2),
  };
}
