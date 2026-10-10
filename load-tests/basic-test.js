import http from 'k6/http';
import { sleep, check } from 'k6';

// Configuration
const BACKEND_IP = __ENV.APPLICATION_IP || 'default-backend-ip';
const API_ENDPOINT = `http://${BACKEND_IP}`; // Using backend IP
const API_KEY = __ENV.API_KEY || 'test-api-key'; // Optional API Key

// Simple headers for testing
const params = {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
};

export const options = {
  // Small, rapid load test with just a few virtual users
  vus: 5, // Virtual users
  duration: '2m', // Run for 2 minutes
};

export default function () {
  // Basic Health check
  const res = http.get(`${API_ENDPOINT}/api/health`, params);
  check(res, {
    'Health check status is 200': (r) => r.status === 200,
    'Health check response time < 200ms': (r) => r.timings.duration < 200,
  });

  // Optional: Add a simple GET request to another endpoint (e.g., messages)
//   const res2 = http.get(`${API_ENDPOINT}/api/messages`, params);
//   check(res2, {
//     'Messages endpoint status is 200': (r) => r.status === 200,
//     'Messages response time < 500ms': (r) => r.timings.duration < 500,
//   });

  sleep(1); // Sleep to simulate user think time
}
