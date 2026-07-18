import { expect, test, type Request } from '@playwright/test';

const API = '**/primetime/v1/**';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const templateId = '33333333-3333-4333-8333-333333333333';
const communicationId = '44444444-4444-4444-8444-444444444444';
const personId = '55555555-5555-4555-8555-555555555555';

async function readJson(request: Request) {
  return JSON.parse(request.postData() || '{}');
}

test.describe('PRIMETIME Release 3 communications', () => {
  test('creates governed communications records without send or delete actions', async ({ page }) => {
    const methods: string[] = [];
    const requestedUrls: string[] = [];
    const postedBodies: Record<string, unknown>[] = [];
    let policyChecks = [
      {
        id: '66666666-6666-4666-8666-666666666666',
        workspace_id: workspaceId,
        communication_id: communicationId,
        check_type: 'consent',
        status: 'approved',
        result: 'Seeded consent check passed',
      },
    ];
    let timelineEvents = [
      {
        id: '77777777-7777-4777-8777-777777777777',
        workspace_id: workspaceId,
        communication_id: communicationId,
        event_type: 'reviewed',
      },
    ];

    await page.route(API, async (route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method();
      methods.push(method);
      requestedUrls.push(url);

      if (method === 'POST' || method === 'PATCH') {
        postedBodies.push(await readJson(request));
      }

      if (url.includes('/workspaces')) {
        return route.fulfill({ json: [{ id: workspaceId, name: 'PRIMETIME Test Workspace' }] });
      }

      if (url.includes('/message-templates')) {
        if (method === 'POST') {
          return route.fulfill({ json: { id: templateId, workspace_id: workspaceId, status: 'draft', name: 'Family readiness follow-up' } });
        }
        if (method === 'PATCH') {
          return route.fulfill({ json: { id: templateId, workspace_id: workspaceId, status: 'approved', approved_by: userId } });
        }
        return route.fulfill({ json: [{ id: templateId, workspace_id: workspaceId, name: 'Family readiness follow-up', channel: 'email', purpose: 'education', status: 'draft' }] });
      }

      if (url.includes('/message-template-versions')) {
        if (method === 'POST') {
          return route.fulfill({ json: { id: '88888888-8888-4888-8888-888888888888', template_id: templateId, version: 1 } });
        }
        return route.fulfill({ json: [{ id: '88888888-8888-4888-8888-888888888888', template_id: templateId, version: 1 }] });
      }

      if (url.includes('/communication-preferences')) {
        if (method === 'POST') {
          return route.fulfill({ json: { id: '99999999-9999-4999-8999-999999999999', workspace_id: workspaceId, person_id: personId, channel: 'email', consent_state: 'granted' } });
        }
        return route.fulfill({ json: [{ id: '99999999-9999-4999-8999-999999999999', workspace_id: workspaceId, person_id: personId, channel: 'email', consent_state: 'granted' }] });
      }

      if (url.includes('/communication-policy-checks')) {
        if (method === 'POST') {
          const body = await readJson(request);
          policyChecks = [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...body }, ...policyChecks];
          return route.fulfill({ json: policyChecks[0] });
        }
        return route.fulfill({ json: policyChecks });
      }

      if (url.includes('/communication-events')) {
        if (method === 'POST') {
          const body = await readJson(request);
          timelineEvents = [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ...body }, ...timelineEvents];
          return route.fulfill({ json: timelineEvents[0] });
        }
        return route.fulfill({ json: timelineEvents });
      }

      if (url.includes('/communications')) {
        if (method === 'POST') {
          return route.fulfill({ json: { id: communicationId, workspace_id: workspaceId, person_id: personId, template_id: templateId, status: 'draft', channel: 'email' } });
        }
        if (method === 'PATCH') {
          return route.fulfill({ json: { id: communicationId, workspace_id: workspaceId, status: 'approved' } });
        }
        return route.fulfill({ json: [{ id: communicationId, workspace_id: workspaceId, person_id: personId, template_id: templateId, status: 'draft', channel: 'email' }] });
      }

      return route.fulfill({ json: [] });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: { access_token: 'test-token', user: { id: '22222222-2222-4222-8222-222222222222' } } }));
    });

    await page.goto('/primetime/communications');
    await expect(page.getByRole('heading', { name: 'Governed Communications' })).toBeVisible();
    await expect(page.getByText('No autonomous sending')).toBeVisible();

    await page.getByRole('button', { name: 'Create template draft' }).click();
    await page.getByRole('button', { name: 'Approve' }).first().click();
    await page.getByRole('button', { name: 'Create template version' }).click();
    await page.getByRole('button', { name: 'Record preference' }).click();
    await page.getByRole('button', { name: 'Create draft communication' }).click();
    await page.getByRole('button', { name: 'Record policy check' }).click();
    await page.getByRole('button', { name: 'Record timeline event' }).click();

    expect(requestedUrls.some((url) => url.includes('/message-templates'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('/message-template-versions'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('/communication-preferences'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('/communications'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('/communication-policy-checks'))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('/communication-events'))).toBe(true);

    expect(requestedUrls.some((url) => url.includes('/send'))).toBe(false);
    expect(methods).not.toContain('DELETE');
    expect(postedBodies.some((body) => body.status === 'draft')).toBe(true);
    expect(postedBodies.some((body) => body.status === 'sent' || body.status === 'delivered')).toBe(false);
  });
});
