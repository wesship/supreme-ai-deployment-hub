import { expect, test } from '@playwright/test';

const workspaceId = '00000000-0000-0000-0000-000000000055';
const metricId = '00000000-0000-0000-0000-000000000501';
const dashboardId = '00000000-0000-0000-0000-000000000502';
const widgetId = '00000000-0000-0000-0000-000000000503';
const observationId = '00000000-0000-0000-0000-000000000504';

test.describe('PRIMETIME Release 5 analytics command center', () => {
  test('records governed analytics snapshots without business mutation', async ({ page }) => {
    const requests: { method: string; url: string }[] = [];
    const metrics: any[] = [{ id: metricId, workspace_id: workspaceId, metric_key: 'open_leads', name: 'Open leads', category: 'funnel' }];
    const dashboards: any[] = [{ id: dashboardId, workspace_id: workspaceId, name: 'Executive Command Center', audience: 'executive', status: 'active' }];
    const widgets: any[] = [{ id: widgetId, workspace_id: workspaceId, dashboard_id: dashboardId, widget_key: 'governance_scorecard', title: 'Governance Scorecard', status: 'active' }];
    const snapshots: any[] = [];
    const funnel: any[] = [];
    const agents: any[] = [];
    const compliance: any[] = [];
    const aiActions: any[] = [];
    const observations: any[] = [];

    await page.route('**/primetime/v1/**', async (route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method();
      requests.push({ method, url });

      if (url.includes('/workspaces')) {
        await route.fulfill({ json: [{ id: workspaceId, name: 'DEVONN PRIMETIME' }] });
        return;
      }

      const body = method === 'POST' || method === 'PATCH' ? request.postDataJSON() : null;
      const withId = (record: any, fallback: string) => ({ id: fallback, ...record });

      if (url.includes('/analytics/metric-definitions')) {
        if (method === 'POST') {
          const record = withId(body, `metric-${metrics.length + 1}`);
          metrics.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        await route.fulfill({ json: metrics });
        return;
      }

      if (url.includes('/analytics/executive-dashboards')) {
        if (method === 'POST') {
          const record = withId(body, `dashboard-${dashboards.length + 1}`);
          dashboards.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        await route.fulfill({ json: dashboards });
        return;
      }

      if (url.includes('/analytics/dashboard-widgets')) {
        if (method === 'POST') {
          const record = withId(body, `widget-${widgets.length + 1}`);
          widgets.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        await route.fulfill({ json: widgets });
        return;
      }

      if (url.includes('/analytics/snapshots')) {
        if (method === 'POST') {
          const record = withId(body, `snapshot-${snapshots.length + 1}`);
          snapshots.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        await route.fulfill({ json: snapshots });
        return;
      }

      if (url.includes('/analytics/funnel-stage-snapshots')) {
        if (method === 'POST') {
          const record = withId(body, `funnel-${funnel.length + 1}`);
          funnel.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        await route.fulfill({ json: funnel });
        return;
      }

      if (url.includes('/analytics/agent-performance-snapshots')) {
        if (method === 'POST') {
          const record = withId(body, `agent-${agents.length + 1}`);
          agents.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        await route.fulfill({ json: agents });
        return;
      }

      if (url.includes('/analytics/compliance-metric-snapshots')) {
        if (method === 'POST') {
          const record = withId(body, `compliance-${compliance.length + 1}`);
          compliance.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        await route.fulfill({ json: compliance });
        return;
      }

      if (url.includes('/analytics/ai-action-metric-snapshots')) {
        if (method === 'POST') {
          const record = withId(body, `ai-action-${aiActions.length + 1}`);
          aiActions.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        await route.fulfill({ json: aiActions });
        return;
      }

      if (url.includes('/analytics/release-governance-observations')) {
        if (method === 'POST') {
          const record = withId(body, observationId);
          observations.unshift(record);
          await route.fulfill({ json: record });
          return;
        }
        if (method === 'PATCH') {
          observations[0] = { ...observations[0], ...body, id: observationId };
          await route.fulfill({ json: observations[0] });
          return;
        }
        await route.fulfill({ json: observations });
        return;
      }

      await route.fulfill({ status: 404, json: { detail: 'unexpected primetime route' } });
    });

    await page.goto('/primetime/executive-command-center');
    await expect(page.getByRole('heading', { name: 'Executive Command Center' })).toBeVisible();
    await expect(page.getByText('observation records only')).toBeVisible();

    await page.getByRole('button', { name: 'Create metric' }).click();
    await expect(page.getByText('Pipeline health')).toBeVisible();

    await page.getByRole('button', { name: 'Create dashboard' }).click();
    await expect(page.getByText('PRIMETIME Executive Command Center')).toBeVisible();

    await page.getByRole('button', { name: 'Add widget' }).click();
    await expect(page.getByText('Widgets configured:')).toBeVisible();

    await page.getByRole('button', { name: 'Create snapshot' }).click();
    await expect(page.getByText('value 12')).toBeVisible();

    await page.getByRole('button', { name: 'Record funnel snapshot' }).click();
    await expect(page.getByText('Appointment scheduled/completed')).toBeVisible();

    await page.getByRole('button', { name: 'Record agent performance' }).click();
    await expect(page.getByText('Score 88')).toBeVisible();

    await page.getByRole('button', { name: 'Record compliance snapshot' }).click();
    await expect(page.getByText('Compliance score 91')).toBeVisible();

    await page.getByRole('button', { name: 'Record AI action snapshot' }).click();
    await expect(page.getByText('Blocked 3 / Proposed 12')).toBeVisible();

    await page.getByRole('button', { name: 'Create observation' }).click();
    await expect(page.getByText('Analytics exit gate requires CI and compliance review')).toBeVisible();

    await page.getByRole('button', { name: 'Resolve observation' }).click();
    await expect(page.getByText('release-5 · warning · resolved')).toBeVisible();

    expect(requests.some((request) => request.url.includes('/analytics/metric-definitions') && request.method === 'POST')).toBe(true);
    expect(requests.some((request) => request.url.includes('/analytics/executive-dashboards') && request.method === 'POST')).toBe(true);
    expect(requests.some((request) => request.url.includes('/analytics/dashboard-widgets') && request.method === 'POST')).toBe(true);
    expect(requests.some((request) => request.url.includes('/analytics/snapshots') && request.method === 'POST')).toBe(true);
    expect(requests.some((request) => request.url.includes('/analytics/release-governance-observations') && request.method === 'PATCH')).toBe(true);

    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);
    expect(requests.some((request) => request.url.includes('/send'))).toBe(false);
    expect(requests.some((request) => request.url.includes('/quote'))).toBe(false);
    expect(requests.some((request) => request.url.includes('/recommend-policy'))).toBe(false);
    expect(requests.some((request) => request.url.includes('/submit-application'))).toBe(false);
    expect(requests.some((request) => request.url.includes('/people') && request.method !== 'GET')).toBe(false);
    expect(requests.some((request) => request.url.includes('/leads') && request.method !== 'GET')).toBe(false);
    expect(requests.some((request) => request.url.includes('/communications') && request.method !== 'GET')).toBe(false);
    expect(requests.some((request) => request.url.includes('/ai-action-ledger') && request.method !== 'GET')).toBe(false);
  });
});
