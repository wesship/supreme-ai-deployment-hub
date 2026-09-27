import { expect, test, type Page } from '@playwright/test';

const PROJECT_REF = 'tjygexesognbkwualywq';
const AUTH_STORAGE_KEYS = [
  `sb-${PROJECT_REF}-auth-token`,
  'sb-placeholder-auth-token',
];
const SUPABASE_ORIGINS = [
  `https://${PROJECT_REF}.supabase.co`,
  'https://placeholder.supabase.co',
];
const HERMES_COMMAND_URL = 'https://api.d3vonn.io/api/voice/hermes/command';
const CORRELATION_ID = '11111111-2222-4333-8444-555555555555';

function base64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function seedSignedInSession(page: Page) {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: '22222222-3333-4444-8555-666666666666',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'journey-test@example.test',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const accessToken = [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: now + 3600 }),
    'journey-test-signature',
  ].join('.');
  const session = {
    access_token: accessToken,
    refresh_token: 'journey-test-refresh-token',
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: 'bearer',
    user,
  };

  await page.addInitScript(({ keys, value }) => {
    for (const key of keys) window.localStorage.setItem(key, JSON.stringify(value));
  }, { keys: AUTH_STORAGE_KEYS, value: session });
}

async function stubSignedInDependencies(page: Page) {
  for (const origin of SUPABASE_ORIGINS) {
    await page.route(`${origin}/rest/v1/**`, async (route) => {
      const url = route.request().url();
      const body = url.includes('/rpc/dashboard_schema_readiness')
        ? JSON.stringify([{ ready: true, missing: [] }])
        : '[]';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body,
      });
    });
  }

  await page.route('**/api/status-health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        checkedAt: new Date().toISOString(),
        services: [
          { id: 'frontend', name: 'Frontend & Edge', status: 'online', latency: 8 },
          { id: 'api-health', name: 'API Gateway', status: 'online', latency: 12 },
        ],
      }),
    });
  });

  await page.route(HERMES_COMMAND_URL, async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as { action?: string; node_id?: string };
    expect(request.headers()['authorization']).toContain('Bearer ');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        status: payload.action === 'connect' ? 'approval_required' : 'queued',
        action: payload.action ?? 'command',
        task_id: 'journey-task-1',
        correlation_id: CORRELATION_ID,
        node_id: payload.node_id ?? null,
        target_node_id: null,
        governed_execution: true,
      }),
    });
  });

  await page.route(/https:\/\/api\.d3vonn\.io\/api\/hermes\/events\/stream.*/, async (route) => {
    const headers = route.request().headers();
    expect(headers.authorization).toContain('Bearer ');
    const now = new Date().toISOString();
    const events = [
      { id: 'event-1', type: 'task.created', message: 'Hermes task created', level: 'info', correlationId: CORRELATION_ID, timestamp: now },
      { id: 'event-2', type: 'task.running', message: 'Hermes execution running', level: 'info', correlationId: CORRELATION_ID, timestamp: now, agentName: 'Hermes' },
      { id: 'event-3', type: 'task.completed', message: 'Hermes execution completed', level: 'info', correlationId: CORRELATION_ID, timestamp: now, agentName: 'Hermes' },
    ];
    const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-cache',
      },
      body,
    });
  });
}

test.describe('signed-in first-user journey', () => {
  test('login state -> app -> Hermes -> Neural Nexus -> completion -> approval guard', async ({ page }) => {
    await seedSignedInSession(page);
    await stubSignedInDependencies(page);

    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: 'What needs your attention' })).toBeVisible();
    await expect(page.getByText('First-run onboarding', { exact: true })).toBeVisible();

    // DeferredProviders intentionally remounts the app shell shortly after first paint.
    // Wait for that boundary to settle before entering stateful command text.
    await page.waitForTimeout(250);
    const command = page.getByLabel('Ask or instruct Hermes');
    const sendCommand = page.getByRole('button', { name: 'Send instruction to Hermes' });
    await command.fill('Summarize what needs my attention today.');
    await expect(sendCommand).toBeEnabled();
    await sendCommand.click();
    await expect(page.getByText(`Queued · ${CORRELATION_ID.slice(0, 8)}`, { exact: true })).toBeVisible();

    await page.getByRole('link', { name: /Run your first governed task/ }).click();
    await expect(page).toHaveURL(/\/knowledge-graph$/);
    await expect(page.getByRole('heading', { name: 'Connect Everything. Make It Work.' })).toBeVisible();

    const instruction = page.getByLabel('Text Hermes instructions');
    await instruction.fill('Run a governed status check through Hermes.');
    await page.getByRole('button', { name: 'Send to Hermes' }).click();

    const statusPanel = page.locator('section').filter({ hasText: 'System status' }).first();
    await expect(statusPanel.getByText('complete', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.goto('/approvals', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/unauthorized$/);
  });
});