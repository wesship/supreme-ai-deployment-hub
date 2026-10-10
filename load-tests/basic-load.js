
import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

/**
 * Comprehensive load test suite for Devonn.AI API
 * 
 * This script tests the API endpoints under various load scenarios
 * Run with: k6 run basic-load.js
 */

// Configuration

const BACKEND_IP = __ENV.APPLICATION_IP || 'default-backend-ip';
const API_ENDPOINT = `http://${BACKEND_IP}`;

// const API_ENDPOINT = __ENV.API_ENDPOINT || 'https://api.d3vonn.io';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// Custom metrics
const errorRate = new Rate('error_rate');
const successRate = new Rate('success_rate');
const requestDuration = new Trend('request_duration');
const contentSize = new Trend('response_content_size');
const requestsCounter = new Counter('total_requests');
const apiErrorCounter = new Counter('api_errors');
const businessErrorCounter = new Counter('business_logic_errors');

// Test scenarios
export const options = {
  scenarios: {
    // Warm-up phase with low load
    warm_up: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 }
      ],
      gracefulRampDown: '30s',
      exec: 'warmup',
    },
    
    // Constant load test
    constant_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      startTime: '1m30s',
      exec: 'constantLoad',
    },
    
    // Spike test to simulate traffic surges
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '30s', target: 30 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 5 },
      ],
      startTime: '5m',
      exec: 'spikeTest',
    },
    
    // Stress test to find breaking points
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      startTime: '7m',
      exec: 'stressTest',
    },
    
    // NEW: Performance baseline test
    baseline_test: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 100,
      startTime: '15m',
      exec: 'baselineTest',
    },
    
    // NEW: Soak test to verify system stability over time
    soak_test: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30m',
      startTime: '20m',
      exec: 'soakTest',
    },
    
    // NEW: Ramp-up and down test to validate scaling
    scaling_test: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { duration: '5m', target: 20 },  // Ramp up to 20 RPS
        { duration: '10m', target: 20 }, // Stay at 20 RPS
        { duration: '5m', target: 0 }    // Ramp down to 0 RPS
      ],
      startTime: '50m',
      exec: 'scalingTest',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'], // 95% under 500ms, 99% under 1.5s
    http_req_failed: ['rate<0.01'],                 // Less than 1% failure rate
    'http_req_duration{endpoint:health}': ['p(99)<200'],  // Health endpoint faster
    'http_req_duration{endpoint:graphql}': ['p(95)<1000'], // GraphQL can be slower
    error_rate: ['rate<0.02'],               // Overall error rate under 2%
    success_rate: ['rate>0.98'],             // Success rate over 98%
  },
};

// Headers setup
const params = {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
};

// User sessions - simulating different user patterns
const userProfiles = {
  admin: {
    weight: 0.1,  // 10% of users
    endpoints: ['/api/admin/stats', '/api/admin/users', '/api/admin/settings'],
    thinkTime: [1, 3] // seconds between requests
  },
  powerUser: {
    weight: 0.2,  // 20% of users
    endpoints: ['/api/agents', '/api/workflows', '/api/templates'],
    thinkTime: [2, 5]
  },
  regularUser: {
    weight: 0.5,  // 50% of users
    endpoints: ['/api/health', '/api/status', '/api/messages'],
    thinkTime: [3, 8]
  },
  anonymousUser: {
    weight: 0.2,  // 20% of users
    endpoints: ['/api/health', '/api/public'],
    thinkTime: [1, 2]
  }
};

// Helper function to select user profile based on weights
function selectUserProfile() {
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const profile in userProfiles) {
    cumulativeWeight += userProfiles[profile].weight;
    if (random <= cumulativeWeight) {
      return userProfiles[profile];
    }
  }
  return userProfiles.regularUser; // Default fallback
}

// Warm-up phase execution function - gentle load
export function warmup() {
  const res = http.get(`${API_ENDPOINT}/api/health`, params);
  recordMetrics(res, 'health');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
}

// Constant load execution function - steady traffic
export function constantLoad() {
  const profile = selectUserProfile();
  const endpoint = randomItem(profile.endpoints);
  
  const res = http.get(`${API_ENDPOINT}${endpoint}`, params);
  recordMetrics(res, endpoint.slice(5)); // Remove '/api/' prefix
  
  const checksPassed = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!checksPassed);
  successRate.add(checksPassed);
  
  // Sleep for random time simulating user think time
  sleep(randomIntBetween(profile.thinkTime[0], profile.thinkTime[1]));
}

// Spike test execution function - sudden traffic increases
export function spikeTest() {
  group('API operations during spike', () => {
    // Mix of GET and POST requests
    if (Math.random() > 0.7) {
      // 30% POST requests
      const payload = JSON.stringify({
        message: 'Test message',
        timestamp: new Date().toISOString(),
        priority: randomItem(['low', 'medium', 'high']),
        data: Array(randomIntBetween(5, 15)).fill(0).map((_, i) => ({ id: i, value: `value-${i}` }))
      });
      
      const res = http.post(`${API_ENDPOINT}/api/messages`, payload, params);
      recordMetrics(res, 'messages_post');
      
      check(res, {
        'status is 201': (r) => r.status === 201,
        'response time < 1s': (r) => r.timings.duration < 1000,
        'contains id': (r) => r.json('id') !== undefined,
      });
    } else {
      // 70% GET requests
      const res = http.get(`${API_ENDPOINT}/api/messages`, params);
      recordMetrics(res, 'messages_get');
      
      check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 800ms': (r) => r.timings.duration < 800,
        'is array': (r) => Array.isArray(r.json()),
      });
    }
  });
  
  sleep(0.5); // Short pause between requests to generate high load
}

// Stress test execution function - finding breaking points
export function stressTest() {
  group('Complex GraphQL operations', () => {
    // Complex operation to stress the system
    const payload = JSON.stringify({
      query: `query {
        agents(limit: 20) {
          id
          name
          status
          capabilities {
            id
            name
            description
          }
          history(limit: 10) {
            id
            timestamp
            action
            result
          }
        }
      }`
    });
    
    const res = http.post(`${API_ENDPOINT}/api/graphql`, payload, params);
    recordMetrics(res, 'graphql');
    
    check(res, {
      'status is 200': (r) => r.status === 200,
      'contains data': (r) => r.json('data') !== null,
      'no errors': (r) => r.json('errors') === undefined,
    });
    
    // Also test a simple endpoint to compare performance
    const healthRes = http.get(`${API_ENDPOINT}/api/health`, params);
    recordMetrics(healthRes, 'health');
    
    check(healthRes, {
      'health check still works': (r) => r.status === 200,
    });
  });
  
  sleep(1);
}

// NEW: Baseline performance test
export function baselineTest() {
  group('API baseline performance', () => {
    const endpoints = [
      { path: '/api/health', method: 'GET', tag: 'health' },
      { path: '/api/status', method: 'GET', tag: 'status' },
      { path: '/api/messages', method: 'GET', tag: 'messages_get' },
      { path: '/api/agents', method: 'GET', tag: 'agents_get' }
    ];
    
    endpoints.forEach(endpoint => {
      const res = http.get(`${API_ENDPOINT}${endpoint.path}`, params);
      recordMetrics(res, endpoint.tag);
      
      check(res, {
        [`${endpoint.tag} status is 200`]: (r) => r.status === 200,
      });
    });
    
    // Test a standard POST operation
    const postPayload = JSON.stringify({
      content: 'Baseline test message',
      type: 'baseline'
    });
    
    const postRes = http.post(`${API_ENDPOINT}/api/messages`, postPayload, params);
    recordMetrics(postRes, 'messages_post');
    
    check(postRes, {
      'post operation successful': (r) => r.status === 201 || r.status === 200,
    });
  });
}

// NEW: Soak test for long-term stability
export function soakTest() {
  const userProfile = selectUserProfile();
  const endpoint = randomItem(userProfile.endpoints);
  
  // Perform regular API operations with a mix of read and write operations
  if (Math.random() > 0.8) { // 20% write operations
    const payload = JSON.stringify({
      data: `Soak test data ${new Date().toISOString()}`,
      metadata: {
        test: 'soak',
        timestamp: Date.now(),
        iteration: __ITER
      }
    });
    
    const res = http.post(`${API_ENDPOINT}${endpoint}`, payload, params);
    recordMetrics(res, `${endpoint.slice(5)}_write`);
  } else { // 80% read operations
    const res = http.get(`${API_ENDPOINT}${endpoint}`, params);
    recordMetrics(res, `${endpoint.slice(5)}_read`);
  }
  
  // During soak testing, we want to occasionally check system health
  if (Math.random() > 0.9) { // 10% health checks
    const healthRes = http.get(`${API_ENDPOINT}/api/health`, params);
    check(healthRes, {
      'health check during soak': (r) => r.status === 200,
    });
  }
  
  sleep(randomIntBetween(1, 5)); // Varied think time
}

// NEW: Scaling test with gradually increasing load
export function scalingTest() {
  // Test a mix of endpoints to validate system scaling capabilities
  const operations = [
    { method: 'GET', path: '/api/agents', tag: 'agents' },
    { method: 'GET', path: '/api/workflows', tag: 'workflows' },
    { method: 'GET', path: '/api/metrics', tag: 'metrics' },
    { method: 'POST', path: '/api/agents/query', tag: 'agents_query', payload: { query: 'test' } },
  ];
  
  const operation = randomItem(operations);
  let res;
  
  if (operation.method === 'GET') {
    res = http.get(`${API_ENDPOINT}${operation.path}`, params);
  } else {
    const payload = JSON.stringify(operation.payload || {});
    res = http.post(`${API_ENDPOINT}${operation.path}`, payload, params);
  }
  
  recordMetrics(res, operation.tag);
  
  // For scaling tests, we're particularly interested in response time trends
  requestDuration.add(res.timings.duration, { endpoint: operation.tag });
  
  check(res, {
    [`${operation.tag} returns successfully`]: (r) => r.status >= 200 && r.status < 300,
    [`${operation.tag} response time`]: (r) => r.timings.duration < 2000,
  });
}

// Helper function to record metrics consistently across all tests
function recordMetrics(response, endpoint) {
  requestsCounter.add(1);
  requestDuration.add(response.timings.duration, { endpoint });
  contentSize.add(response.body.length, { endpoint });
  
  if (response.status >= 400) {
    apiErrorCounter.add(1, { endpoint, status: response.status });
  }
  
  // Check for business logic errors in the response body
  try {
    const body = response.json();
    if (body && body.error) {
      businessErrorCounter.add(1, { endpoint, error: body.error.code || 'unknown' });
    }
  } catch (e) {
    // Not JSON or couldn't parse - that's okay
  }
}

// Execute this default function if no specific scenario is selected
export default function() {
  warmup();
  constantLoad();
}

// Function to parse response times and establish performance baselines
export function handleSummary(data) {
  console.log('Performance test completed!');
  console.log('========== BASELINES ==========');
  
  // Extract p95 response times for key endpoints
  const baselines = {
    health: data.metrics.http_req_duration.values['p(95)'],
    messages: data.metrics.http_req_duration.values['p(95)'],
    agents: data.metrics.http_req_duration.values['p(95)'],
    graphql: data.metrics.http_req_duration.values['p(95)'],
  };
  
  console.log('Recommended performance baselines (p95):');
  console.log(JSON.stringify(baselines, null, 2));
  
  return {
    'summary.json': JSON.stringify(data, null, 2),
  };
}

