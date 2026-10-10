import { expect, test } from '@playwright/test';

test.describe('D3VONN.IO production RUM CORS', () => {
  test('public RUM telemetry authorizes the canonical D3VONN origin', async ({ request }) => {
    const response = await request.fetch('https://api.d3vonn.io/api/assurance/public/rum', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://d3vonn.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    expect(response.status()).toBeLessThan(400);
    expect(response.headers()['access-control-allow-origin']).toBe('https://d3vonn.io');
    expect(response.headers()['access-control-allow-methods']).toContain('POST');
  });
});
