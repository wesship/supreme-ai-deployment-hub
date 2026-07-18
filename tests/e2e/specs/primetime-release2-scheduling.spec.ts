import { expect, type Page, type Request, test } from '@playwright/test';

type PrimetimeRecord = Record<string, unknown>;

const workspaceId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const appointmentId = '33333333-3333-4333-8333-333333333333';
const createdAppointmentId = '44444444-4444-4444-8444-444444444444';
const personId = '55555555-5555-4555-8555-555555555555';

async function installSchedulingMocks(page: Page) {
  const requests: { method: string; path: string; body?: PrimetimeRecord }[] = [];
  let appointments: PrimetimeRecord[] = [
    {
      id: appointmentId,
      workspace_id: workspaceId,
      owner_id: userId,
      title: 'Family Readiness Review',
      status: 'scheduled',
      starts_at: '2026-07-19T16:00:00.000Z',
      ends_at: '2026-07-19T16:30:00.000Z',
    },
  ];
  let availabilityRules: PrimetimeRecord[] = [];
  let reminders: PrimetimeRecord[] = [];
  let noShows: PrimetimeRecord[] = [];

  async function body(request: Request) {
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

    if (method === 'DELETE') return json({ error: 'delete not allowed in Release 2 scheduling UI' }, 405);
    if (method === 'GET' && path === '/primetime/v1/workspaces') return json([{ id: workspaceId, name: 'PRIMETIME Scheduling Workspace' }]);
    if (method === 'GET' && path === '/primetime/v1/dashboard/daily') return json({
      workspaceId,
      userId,
      role: 'representative',
      openLeads: [],
      openTasks: [],
      exceptions: [],
      summary: { openLeadCount: 0, openTaskCount: 0, exceptionCount: 0 },
    });
    if (method === 'GET' && path === '/primetime/v1/appointments') return json(appointments);
    if (method === 'GET' && path === '/primetime/v1/availability-rules') return json(availabilityRules);
    if (method === 'GET' && path === '/primetime/v1/reminders') return json(reminders);
    if (method === 'GET' && path === '/primetime/v1/no-show-events') return json(noShows);

    if (method === 'POST' && path === '/primetime/v1/appointments') {
      const created = { id: createdAppointmentId, status: 'scheduled', ...payload };
      appointments = [created, ...appointments];
      return json(created, 201);
    }
    if (method === 'PATCH' && path === `/primetime/v1/appointments/${createdAppointmentId}`) {
      appointments = appointments.map((row) => row.id === createdAppointmentId ? { ...row, ...payload } : row);
      if (payload?.status === 'no_show') {
        noShows = [{ id: '66666666-6666-4666-8666-666666666666', workspace_id: workspaceId, appointment_id: createdAppointmentId, recovery_status: 'pending' }, ...noShows];
      }
      return json(appointments.find((row) => row.id === createdAppointmentId));
    }
    if (method === 'POST' && path === '/primetime/v1/availability-rules') {
      const created = { id: '77777777-7777-4777-8777-777777777777', ...payload };
      availabilityRules = [created, ...availabilityRules];
      return json(created, 201);
    }
    if (method === 'POST' && path === '/primetime/v1/reminders') {
      const created = { id: '88888888-8888-4888-8888-888888888888', ...payload };
      reminders = [created, ...reminders];
      return json(created, 201);
    }
    if (method === 'POST' && path === '/primetime/v1/appointment-attendees') {
      return json({ id: '99999999-9999-4999-8999-999999999999', ...payload }, 201);
    }
    if (method === 'POST' && path === '/primetime/v1/calendar-sync-events') {
      return json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', authoritative: false, ...payload }, 201);
    }

    return json({ error: `Unhandled scheduling mock route: ${method} ${path}` }, 404);
  });

  return { requests };
}

test.describe('PRIMETIME Release 2 scheduling flow', () => {
  test('creates scheduling records, triggers no-show recovery, records calendar sync, and emits no delete requests', async ({ page }) => {
    const { requests } = await installSchedulingMocks(page);

    await page.goto('/primetime/scheduling');
    await expect(page.getByRole('heading', { name: 'Scheduling and Daily Operations' })).toBeVisible();
    await expect(page.getByText('PRIMETIME Scheduling Workspace')).toBeVisible();

    const appointmentForm = page.locator('form').filter({ hasText: 'Create appointment' });
    await appointmentForm.getByPlaceholder('Title').fill('New Family Review');
    await appointmentForm.getByLabel('Start').fill('2026-07-20T10:00');
    await appointmentForm.getByLabel('End').fill('2026-07-20T10:30');
    await appointmentForm.getByRole('button', { name: 'Create appointment' }).click();
    await expect(page.getByText('Appointment created and audit logged.')).toBeVisible();
    await expect(page.getByText('New Family Review')).toBeVisible();

    const availabilityForm = page.locator('form').filter({ hasText: 'Create availability' });
    await availabilityForm.getByLabel('Availability start').fill('08:00');
    await availabilityForm.getByLabel('Availability end').fill('16:00');
    await availabilityForm.getByRole('button', { name: 'Create availability' }).click();
    await expect(page.getByText('Availability rule created.')).toBeVisible();

    const reminderForm = page.locator('form').filter({ hasText: 'Create reminder' });
    await reminderForm.locator('select').first().selectOption(createdAppointmentId);
    await reminderForm.getByLabel('Reminder time').fill('2026-07-20T09:30');
    await reminderForm.getByRole('button', { name: 'Create reminder' }).click();
    await expect(page.getByText('Reminder queued.')).toBeVisible();

    const attendeePanel = page.locator('section').filter({ hasText: 'Attendees and calendar sync' });
    await attendeePanel.locator('select').selectOption(createdAppointmentId);
    await attendeePanel.getByPlaceholder('Person ID for attendee').fill(personId);
    await attendeePanel.getByRole('button', { name: 'Add attendee' }).click();
    await expect(page.getByText('Appointment attendee added.')).toBeVisible();

    await attendeePanel.getByPlaceholder('External calendar event ID').fill('gcal-test-event-1');
    await attendeePanel.getByRole('button', { name: 'Record calendar sync' }).click();
    await expect(page.getByText('Calendar sync event recorded as non-authoritative.')).toBeVisible();

    await page.locator('article').filter({ hasText: 'New Family Review' }).getByRole('button', { name: 'No-show' }).click();
    await expect(page.getByText('No-show recovery triggered.')).toBeVisible();
    await expect(page.getByText('pending')).toBeVisible();

    const paths = requests.map((request) => `${request.method} ${request.path}`);
    expect(paths).toContain('POST /primetime/v1/appointments');
    expect(paths).toContain('POST /primetime/v1/availability-rules');
    expect(paths).toContain('POST /primetime/v1/reminders');
    expect(paths).toContain('POST /primetime/v1/appointment-attendees');
    expect(paths).toContain('POST /primetime/v1/calendar-sync-events');
    expect(paths).toContain(`PATCH /primetime/v1/appointments/${createdAppointmentId}`);
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);
  });
});
