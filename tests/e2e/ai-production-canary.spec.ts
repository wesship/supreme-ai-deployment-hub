import { expect, test } from '@playwright/test';

// Release certification suite for authenticated OpenAI chat and bounded RAG round-trip checks.
const siteUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'https://d3vonn.io';
const apiUrl = process.env.D3VONN_API_URL ?? 'https://api.d3vonn.io';
const email = process.env.E2E_TEST_EMAIL?.trim();
const password = process.env.E2E_TEST_PASSWORD?.trim();

test('authenticated chat and RAG canaries complete with cleanup', async ({ page, request }) => {
  test.skip(!email || !password, 'Protected production credentials are required');

  await page.goto(`${siteUrl}/login?redirect=%2Fapp`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.locator('button[type="submit"]').first().click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });

  const token = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!key.includes('auth-token')) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? '{}');
        const accessToken = value?.access_token ?? value?.currentSession?.access_token;
        if (typeof accessToken === 'string' && accessToken.length > 20) return accessToken;
      } catch {
        // Ignore unrelated localStorage values.
      }
    }
    return null;
  });
  expect(token, 'Supabase access token was not found after login').toBeTruthy();

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const tag = `D3VONN-AI-CERT-${Date.now()}`;
  const filename = `${tag}.txt`;

  const chat = await request.post(`${apiUrl}/api/chat`, {
    headers,
    data: {
      messages: [{ role: 'user', content: 'Reply with exactly: D3VONN_OK' }],
      model: 'gpt-4.1-mini',
      stream: false,
      max_tokens: 8,
      temperature: 0,
    },
    timeout: 60_000,
  });
  expect(chat.status(), await chat.text()).toBe(200);
  const chatBody = await chat.json();
  expect(JSON.stringify(chatBody)).toContain('D3VONN_OK');

  try {
    const ingest = await request.post(`${apiUrl}/api/rag/ingest`, {
      headers,
      data: {
        filename,
        chunks: [{
          id: tag,
          text: `${tag} bounded certification fixture`,
          metadata: {
            source: 'production-certification',
            filename,
            chunkIndex: 0,
            totalChunks: 1,
            uploadedAt: new Date().toISOString(),
          },
        }],
      },
      timeout: 60_000,
    });
    expect(ingest.status(), await ingest.text()).toBe(200);
    expect((await ingest.json()).success).toBe(true);

    const retrieve = await request.post(`${apiUrl}/api/rag/retrieve`, {
      headers,
      data: { query: tag, topK: 5, minScore: 0 },
      timeout: 60_000,
    });
    expect(retrieve.status(), await retrieve.text()).toBe(200);
    expect(JSON.stringify(await retrieve.json())).toContain(tag);
  } finally {
    const cleanup = await request.post(`${apiUrl}/api/rag/delete`, {
      headers,
      data: { filename },
      timeout: 45_000,
    });
    expect(cleanup.status(), await cleanup.text()).toBe(200);
    expect((await cleanup.json()).success).toBe(true);
  }
});
