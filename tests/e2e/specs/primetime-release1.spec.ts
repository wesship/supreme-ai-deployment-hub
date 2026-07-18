import { expect, type Page, type Request, test } from '@playwright/test';

type PrimetimeRecord = Record<string, unknown>;

const workspaceId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const stageId = '33333333-3333-4333-8333-333333333333';
const existingPersonId = '44444444-4444-4444-8444-444444444444';
const createdPersonId = '55555555-5555-4555-8555-555555555555';
const createdLeadId = '66666666-6666-4666-8666-666666666666';
const createdTaskId = '77777777-7777-4777-8777-777777777777';

async function installPrimetimeRelease1Mocks(page: Page) {
  const requests: { method: string; path: string; body?: PrimetimeRecord }[] = [];
  let people: PrimetimeRecord[] = [
    {
      id: existingPersonId,
      workspace_id: workspaceId,
      first_name: 'Avery',
      last_name: 'Client',
      email: 'avery@example.com',
      phone: '555-0100',
    },
  ];
  let leads: PrimetimeRecord[] = [
    {
      id: '88888888-8888-4888-8888-888888888888',
      workspace_id: workspaceId,
      person_id: existingPersonId,
      pipeline_stage_id: stageId,
      source: 'referral',
      status: 'open',
      next_action: 'Call Avery',
      next_action_due_at: '2026-07-18T16:00:00.000Z',
    },
  ];
  let tasks: PrimetimeRecord[] = [
    {
      id: '99999999-9999-4999-8999-999999999999',
      workspace_id: workspaceId,
      owner_id: userId,
      title: 'Prepare appointment checklist',
      status: 'open',
      priority: 'normal',
      due_at: '2026-07-18T17:00:00.000Z',
    },
  ];
  const exceptions: PrimetimeRecord[] = [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      workspace_id: workspaceId,
      entity_type: 'lead',
      entity_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      rule_code: 'MISSING_NEXT_ACTION',
      severity: 'high',
      status: 'open',
    },
  ];
  const stages: PrimetimeRecord[] = [
    {
      id: stageId,
      workspace_id: workspaceId,
      name: 'New Lead',
      position: 10,
    },
  ];

  function dashboard() {
    return {
      workspaceId,
      userId,
      role: 'representative',
      openLeads: leads.map((lead) => ({
        id: lead.id,
        status: lead.status,
        next_action: lead.next_action,
        next_action_due_at: lead.next_action_due_at,
      })),
      openTasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        due_at: task.due_at,
        priority: task.priority,
      })),
      exceptions,
      summary: {
        openLeadCount: leads.length,
        openTaskCount: tasks.length,
        exceptionCount: exceptions.length,
      },
    };
  }

  async function body(request: Request): Promise<PrimetimeRecord | undefined> {
    try {
      return await request.postDataJSON();
    } catch {
      return undefined;
    }
  }

  await page.route('**/primetime/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const payload = method === 'POST' || method === 'PATCH' ? await body(request) : undefined;
    requests.push({ method, path, body: payload });

    const json = (data: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });

    if (method === 'DELETE') return json({ error: 'delete not allowed in Release 1 UI' }, 405);

    if (method === 'GET' && path === '/primetime/v1/workspaces') {
      return json([{ id: workspaceId, name: 'PRIMETIME Test Workspace', slug: 'primetime-test' }]);
    }
    if (method === 'GET' && path === '/primetime/v1/dashboard/daily') return json(dashboard());
    if (method === 'GET' && path === '/primetime/v1/people') return json(people);
    if (method === 'GET' && path === '/primetime/v1/people/duplicates') {
      const email = url.searchParams.get('email');
      const phone = url.searchParams.get('phone');
      return json(people.filter((person) => person.email === email || person.phone === phone));
    }
    if (method === 'GET' && path === '/primetime/v1/leads') return json(leads);
    if (method === 'GET' && path === '/primetime/v1/pipeline-stages') return json(stages);
    if (method === 'GET' && path === '/primetime/v1/exceptions') return json(exceptions);

    if (method === 'POST' && path === '/primetime/v1/people') {
      const created = { id: createdPersonId, ...payload };
      people = [created, ...people];
      return json(created, 201);
    }
    if (method === 'POST' && path === '/primetime/v1/leads') {
      const created = { id: createdLeadId, status: 'open', ...payload };
      leads = [created, ...leads];
      return json(created, 201);
    }
    if (method === 'POST' && path === '/primetime/v1/tasks') {
      const created = { id: createdTaskId, status: 'open', ...payload };
      tasks = [created, ...tasks];
      return json(created, 201);
    }
    if (method === 'POST' && path === '/primetime/v1/activities') {
      return json({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ...payload }, 201);
    }
    if (method === 'POST' && path === '/primetime/v1/consent-records') {
      return json({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', ...payload }, 201);
    }
    if (method === 'POST' && path === '/primetime/v1/suppression-records') {
      return json({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', ...payload }, 201);
    }

    return json({ error: `Unhandled mock route: ${method} ${path}` }, 404);
  });

  return { requests };
}

test.describe('PRIMETIME Release 1 governed CRM flow', () => {
  test('completes the seeded create, duplicate-check, consent, suppression, and dashboard-refresh flow without delete actions', async ({ page }) => {
    const { requests } = await installPrimetimeRelease1Mocks(page);

    await page.goto('/primetime');
    await expect(page.getByRole('heading', { name: 'Governed CRM Workspace' })).toBeVisible();
    await expect(page.getByText('PRIMETIME Test Workspace')).toBeVisible();
    await expect(page.getByText('Open leads')).toBeVisible();
    await expect(page.getByText('Exception queue')).toBeVisible();

    const personForm = page.locator('form').filter({ hasText: 'Create person' });
    await personForm.getByLabel('First name').fill('Jordan');
    await personForm.getByLabel('Last name').fill('Prospect');
    await personForm.getByLabel('Email').fill('jordan@example.com');
    await personForm.getByLabel('Phone').fill('555-0199');
    await personForm.getByRole('button', { name: 'Create person' }).click();
    await expect(page.getByText('Person draft created for review.')).toBeVisible();
    await expect(page.getByText('Jordan Prospect')).toBeVisible();

    const duplicateReview = page.locator('section').filter({ hasText: 'Duplicate review' });
    await duplicateReview.getByPlaceholder('Email').fill('jordan@example.com');
    await duplicateReview.getByRole('button', { name: 'Search duplicates' }).click();
    await expect(duplicateReview.getByText('Jordan Prospect')).toBeVisible();

    const leadForm = page.locator('form').filter({ hasText: 'Create lead' });
    await leadForm.getByLabel('Person').selectOption(createdPersonId);
    await leadForm.getByLabel('Source').fill('training referral');
    await leadForm.getByLabel('Next action').fill('Schedule readiness review');
    await leadForm.getByLabel('Next-action deadline').fill('2026-07-19T09:30');
    await leadForm.getByRole('button', { name: 'Create lead' }).click();
    await expect(page.getByText('Lead created with required Release 1 controls.')).toBeVisible();

    const taskForm = page.locator('form').filter({ hasText: 'Create task' });
    await taskForm.getByLabel('Lead').selectOption(createdLeadId);
    await taskForm.getByLabel('Title').fill('Confirm appointment time');
    await taskForm.getByLabel('Due').fill('2026-07-19T08:30');
    await taskForm.getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByText('Task created.')).toBeVisible();

    const activityForm = page.locator('form').filter({ hasText: 'Record activity' });
    await activityForm.getByLabel('Lead').selectOption(createdLeadId);
    await activityForm.getByLabel('Person').selectOption(createdPersonId);
    await activityForm.getByLabel('Summary').fill('Discussed readiness challenge next steps.');
    await activityForm.getByRole('button', { name: 'Record activity' }).click();
    await expect(page.getByText('Activity recorded and audit event written.')).toBeVisible();

    const consentForm = page.locator('form').filter({ hasText: 'Record consent' });
    await consentForm.getByLabel('Person').selectOption(createdPersonId);
    await consentForm.getByLabel('Channel').selectOption('email');
    await consentForm.getByLabel('Source').fill('email opt-in attestation');
    await consentForm.getByRole('button', { name: 'Record consent' }).click();
    await expect(page.getByText('Consent record created.')).toBeVisible();

    const suppressionForm = page.locator('form').filter({ hasText: 'Create suppression record' });
    await suppressionForm.getByLabel('Person').selectOption(createdPersonId);
    await suppressionForm.getByLabel('Channel').selectOption('email');
    await suppressionForm.getByLabel('Reason').fill('Manual opt-out verification');
    await suppressionForm.getByRole('button', { name: 'Create suppression' }).click();
    await expect(page.getByText('Suppression record created.')).toBeVisible();

    const paths = requests.map((request) => `${request.method} ${request.path}`);
    expect(paths).toContain('POST /primetime/v1/people');
    expect(paths).toContain('GET /primetime/v1/people/duplicates');
    expect(paths).toContain('POST /primetime/v1/leads');
    expect(paths).toContain('POST /primetime/v1/tasks');
    expect(paths).toContain('POST /primetime/v1/activities');
    expect(paths).toContain('POST /primetime/v1/consent-records');
    expect(paths).toContain('POST /primetime/v1/suppression-records');
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);

    const dashboardReloads = paths.filter((path) => path === 'GET /primetime/v1/dashboard/daily').length;
    expect(dashboardReloads).toBeGreaterThanOrEqual(2);
  });
});
