import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'https://d3vonn.io';
const testEmail = process.env.E2E_TEST_EMAIL?.trim();
const testPassword = process.env.E2E_TEST_PASSWORD?.trim();

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
});

test.setTimeout(120_000);

async function signIn(page: Page) {
  expect(testEmail, 'E2E_TEST_EMAIL is required for protected voice certification').toBeTruthy();
  expect(testPassword, 'E2E_TEST_PASSWORD is required for protected voice certification').toBeTruthy();

  await page.goto(`${baseUrl}/login?redirect=%2Fvoice-studio`, {
    waitUntil: 'domcontentloaded',
  });

  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await email.fill(testEmail!);
  await password.fill(testPassword!);

  const submit = page.locator('button[type="submit"]').filter({ hasText: /sign in|log in/i }).first();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
}

async function expectCallLifecycle(page: Page) {
  const start = page.getByRole('button', { name: 'Start D3VONN voice conversation' });
  await expect(start).toBeVisible();
  await expect(start).toBeEnabled();

  await start.click();
  const end = page.getByRole('button', { name: 'End D3VONN voice conversation' });
  await expect(end, 'Vapi never emitted a connected call state').toBeVisible({ timeout: 45_000 });

  await end.click();
  await expect(start, 'Voice control did not return to idle after stopping').toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/unable to (start|connect|end).*voice/i)).toHaveCount(0);
}

test.describe.serial('D3VONN production voice browser certification', () => {
  test('signed-out published assistant completes a real Vapi WebRTC lifecycle', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto(`${baseUrl}/voice-studio`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/voice-studio\/?$/);
    await expectCallLifecycle(page);

    expect(pageErrors, `Unhandled browser errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('signed-in voice receives an authenticated Hermes-capable inline session', async ({ page }) => {
    await signIn(page);

    const sessionResponsePromise = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        response.url() === 'https://api.d3vonn.io/api/voice/session',
      { timeout: 30_000 },
    );

    await page.goto(`${baseUrl}/voice-studio`, { waitUntil: 'domcontentloaded' });
    const lifecyclePromise = expectCallLifecycle(page);
    const sessionResponse = await sessionResponsePromise;

    expect(sessionResponse.status(), 'Authenticated voice session request failed').toBe(200);
    expect(sessionResponse.headers()['cache-control']).toContain('no-store');

    const body = (await sessionResponse.json()) as {
      mode?: string;
      assistant?: {
        server?: { url?: string; secret?: string };
        voice?: { provider?: string; voiceId?: string };
        model?: { tools?: Array<{ function?: { name?: string } }> };
      };
    };

    expect(body.mode).toBe('inline-authenticated');
    expect(body.assistant?.voice?.provider).toBe('11labs');
    expect(body.assistant?.voice?.voiceId).toBeTruthy();
    expect(body.assistant?.server?.url).toContain('/api/voice/vapi/webhook');
    expect(body.assistant?.server?.url).toContain('session=');
    expect(body.assistant?.server?.secret).toBeUndefined();

    const toolNames = body.assistant?.model?.tools?.map(tool => tool.function?.name) ?? [];
    expect(toolNames).toContain('create_hermes_task');

    await lifecyclePromise;
  });
});
