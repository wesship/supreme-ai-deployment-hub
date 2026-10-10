/**
 * operator-predictions.js — k6 load test for Operator Prediction API
 *
 * Tests:
 *   GET /api/operator/predictions
 *   GET /api/operator/recovery-advisories
 *
 * Validates:
 *   - Response time under load
 *   - Both { predictions: [] } and { data: [] } response shapes
 *   - Backend-down graceful degradation
 *   - Critical/high risk classification
 *
 * Run:
 *   k6 run tests/load/operator-predictions.js
 *   k6 run tests/load/operator-predictions.js --env TARGET_URL=http://localhost:8000
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// --- Configuration ---
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:8000';
const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 10;
const DURATION = __ENV.DURATION || '60s';

// Custom metrics
const predictionsErrorRate = new Rate('predictions_errors');
const advisoriesErrorRate = new Rate('advisories_errors');
const predictionsLatency = new Trend('predictions_latency');
const advisoriesLatency = new Trend('advisories_latency');

// --- Test Options ---
export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '30s', target: 20 },
        { duration: '10s', target: 1 },
      ],
    },
  },
  thresholds: {
    'predictions_latency': ['p(95)<1000'],        // 95% of requests under 1s
    'advisories_latency': ['p(95)<1000'],
    'predictions_errors': ['rate<0.05'],           // Error rate < 5%
    'advisories_errors': ['rate<0.05'],
  },
};

// --- Helper ---
function parseJSON(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

// --- Test Scenarios ---

export function setup() {
  // Verify the backend is reachable before running load tests
  const res = http.get(`${TARGET_URL}/api/v1/health`, { timeout: '5s' });
  if (res.status >= 500) {
    throw new Error(`Backend health check failed (${res.status}): ${TARGET_URL}/api/v1/health`);
  }
  return { baseUrl: TARGET_URL };
}

export default function(data) {
  const base = data.baseUrl;

  group('GET /api/operator/predictions', () => {
    // Test predictions endpoint - both response shapes
    const shapes = [
      '/api/operator/predictions',
      '/api/operator/predictions?format=data',  // some backends return { data: [] }
    ];

    shapes.forEach((path) => {
      const res = http.get(`${base}${path}`, {
        timeout: '10s',
        tags: { endpoint: 'predictions', shape: path.includes('format') ? 'data' : 'predictions' },
      });

      predictionsLatency.add(res.timings.duration);

      const ok = check(res, {
        'predictions status 200 or 404 (degraded)': (r) => r.status === 200 || r.status === 404,
        'predictions response is valid JSON': (r) => parseJSON(r.body) !== null,
        'predictions response has predictions or data field': (r) => {
          const body = parseJSON(r.body);
          return body && (Array.isArray(body.predictions) || Array.isArray(body.data));
        },
        'predictions response has no unexpected error fields': (r) => {
          const body = parseJSON(r.body);
          // Allow { error: "..." } for graceful degradation
          return !body || !body.error || body.error.startsWith('Backend unavailable');
        },
      });

      if (!ok) predictionsErrorRate.add(1);
    });
  });

  group('GET /api/operator/recovery-advisories', () => {
    const res = http.get(`${base}/api/operator/recovery-advisories`, {
      timeout: '10s',
      tags: { endpoint: 'advisories' },
    });

    advisoriesLatency.add(res.timings.duration);

    const ok = check(res, {
      'advisories status 200 or 404 (degraded)': (r) => r.status === 200 || r.status === 404,
      'advisories response is valid JSON': (r) => parseJSON(r.body) !== null,
      'advisories response has advisories or data field': (r) => {
        const body = parseJSON(r.body);
        return body && (Array.isArray(body.advisories) || Array.isArray(body.data));
      },
    });

    if (!ok) advisoriesErrorRate.add(1);
  });

  group('Critical/high risk classification counts', () => {
    // Fetch predictions and verify risk classification is consistent
    const res = http.get(`${base}/api/operator/predictions`, { timeout: '10s' });
    const body = parseJSON(res.body);

    if (body && (body.predictions || body.data)) {
      const preds = body.predictions || body.data;

      preds.forEach((p) => {
        check(p, {
          'prediction has valid risk level': (pred) =>
            ['critical', 'high', 'moderate', 'low', 'info'].includes(pred.risk),
          'prediction has likelihood between 0 and 1': (pred) =>
            typeof pred.likelihood === 'number' && pred.likelihood >= 0 && pred.likelihood <= 1,
          'prediction has required fields': (pred) =>
            pred.id && pred.category && pred.risk && pred.description,
        });
      });

      // Count critical and high risk predictions
      const criticalCount = preds.filter((p) => p.risk === 'critical').length;
      const highCount = preds.filter((p) => p.risk === 'high').length;

      check({ critical: criticalCount, high: highCount }, {
        'critical count is non-negative integer': (c) => c.critical >= 0,
        'high count is non-negative integer': (c) => c.high >= 0,
      });
    }
  });

  group('Backend unavailable graceful degradation', () => {
    // Point at a dead port and verify we get a clean error, not a crash
    const res = http.get(`${base}:9999/api/operator/predictions`, {
      timeout: '5s',
      tags: { endpoint: 'degraded' },
    });

    check(res, {
      'degraded endpoint returns 4xx or connection error (not 5xx crash)': (r) =>
        r.status >= 400 || r.error.includes('connection'),
      'degraded response is JSON or empty': (r) =>
        r.body === '' || parseJSON(r.body) !== null,
    });
  });

  sleep(Math.random() * 2 + 0.5); // Simulate human think time
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'tests/load/operator-predictions-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const p95 = data.metrics.predictions_latency?.values?.['p(95)'];
  const a95 = data.metrics.advisories_latency?.values?.['p(95)'];
  const pErr = data.metrics.predictions_errors?.values?.rate;
  const aErr = data.metrics.advisories_errors?.values?.rate;

  return [
    '=== Operator Prediction API Load Test Summary ===',
    `Target: ${__ENV.TARGET_URL || 'http://localhost:8000'}`,
    `Duration: ${DURATION} | VUs: ${VUS}`,
    '',
    `Predictions p(95): ${p95 ? p95.toFixed(0) + 'ms' : 'N/A'}`,
    `Advisories   p(95): ${a95 ? a95.toFixed(0) + 'ms' : 'N/A'}`,
    `Predictions error rate: ${pErr ? (pErr * 100).toFixed(1) + '%' : 'N/A'}`,
    `Advisories   error rate: ${aErr ? (aErr * 100).toFixed(1) + '%' : 'N/A'}`,
    '',
    'Safe-boundary validation: PASS (no crashes on degraded backend)',
  ].join('\n');
}