import { expect, type Page, type Request, test } from '@playwright/test';

const workspaceId = '00000000-0000-4000-8000-000000000001';
const ids = {
  agent: '00000000-0000-4000-8000-000000000010',
  version: '00000000-0000-4000-8000-000000000011',
  request: '00000000-0000-4000-8000-000000000012',
  output: '00000000-0000-4000-8000-000000000013',
  action: '00000000-0000-4000-8000-000000000014',
  approval: '00000000-0000-4000-8000-000000000015',
  finding: '00000000-0000-4000-8000-000000000016',
  citation: '00000000-0000-4000-8000-000000000017',
};

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(request.postData() || '{}');
  } catch {
    return {};
  }
}

test('PRIMETIME Release 4 AI Assistance stays draft-first and governed', async ({ page }) => {
  const requests: string[] = [];
  const methods: string[] = [];

  await page.route('**/primetime/v1/**', async (route, request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push(path);
    methods.push(request.method());

    if (path.endsWith('/workspaces')) {
      await route.fulfill({ json: [{ id: workspaceId, name: 'Seeded PRIMETIME Workspace' }] });
      return;
    }

    const payload = await body(request);
    if (path.endsWith('/ai-agents') && request.method() === 'GET') {
      await route.fulfill({ json: [{ id: ids.agent, key: 'intake_agent', name: 'Intake Agent', status: 'draft' }] });
      return;
    }
    if (path.endsWith('/ai-agents') && request.method() === 'POST') {
      await route.fulfill({ json: { id: ids.agent, ...payload } });
      return;
    }
    if (path.includes('/ai-agents/') && request.method() === 'PATCH') {
      await route.fulfill({ json: { id: ids.agent, ...payload } });
      return;
    }

    if (path.endsWith('/ai-agent-versions') && request.method() === 'GET') {
      await route.fulfill({ json: [{ id: ids.version, agent_id: ids.agent, version: 1, status: 'draft' }] });
      return;
    }
    if (path.endsWith('/ai-agent-versions') && request.method() === 'POST') {
      await route.fulfill({ json: { id: ids.version, ...payload } });
      return;
    }

    if (path.endsWith('/ai-assistance-requests') && request.method() === 'GET') {
      await route.fulfill({ json: [{ id: ids.request, agent_key: 'meeting_prep_agent', request_type: 'meeting_prep', status: 'requested' }] });
      return;
    }
    if (path.endsWith('/ai-assistance-requests') && request.method() === 'POST') {
      await route.fulfill({ json: { id: ids.request, ...payload } });
      return;
    }

    if (path.endsWith('/ai-assistance-outputs') && request.method() === 'GET') {
      await route.fulfill({ json: [{ id: ids.output, output_type: 'meeting_brief', status: 'draft', requires_licensed_review: true }] });
      return;
    }
    if (path.endsWith('/ai-assistance-outputs') && request.method() === 'POST') {
      await route.fulfill({ json: { id: ids.output, ...payload } });
      return;
    }
    if (path.includes('/ai-assistance-outputs/') && request.method() === 'PATCH') {
      await route.fulfill({ json: { id: ids.output, output_type: 'meeting_brief', ...payload } });
      return;
    }

    if (path.endsWith('/ai-action-ledger') && request.method() === 'GET') {
      await route.fulfill({ json: [{ id: ids.action, action_type: 'create_task', action_status: 'proposed', target_table: 'tasks' }] });
      return;
    }
    if (path.endsWith('/ai-action-ledger') && request.method() === 'POST') {
      await route.fulfill({ json: { id: ids.action, ...payload } });
      return;
    }

    if (path.endsWith('/ai-approval-requests') && request.method() === 'GET') {
      await route.fulfill({ json: [{ id: ids.approval, review_type: 'licensed', status: 'pending', reason: 'Licensed review required' }] });
      return;
    }
    if (path.endsWith('/ai-approval-requests') && request.method() === 'POST') {
      await route.fulfill({ json: { id: ids.approval, ...payload } });
      return;
    }
    if (path.includes('/ai-approval-requests/') && request.method() === 'PATCH') {
      await route.fulfill({ json: { id: ids.approval, review_type: 'licensed', ...payload } });
      return;
    }

    if (path.endsWith('/ai-compliance-findings') && request.method() === 'GET') {
      await route.fulfill({ json: [{ id: ids.finding, severity: 'warning', rule_key: 'human_approval_required', status: 'open' }] });
      return;
    }
    if (path.endsWith('/ai-compliance-findings') && request.method() === 'POST') {
      await route.fulfill({ json: { id: ids.finding, ...payload } });
      return;
    }
    if (path.includes('/ai-compliance-findings/') && request.method() === 'PATCH') {
      await route.fulfill({ json: { id: ids.finding, severity: 'warning', rule_key: 'human_approval_required', ...payload } });
      return;
    }

    if (path.endsWith('/ai-knowledge-citations') && request.method() === 'GET') {
      await route.fulfill({ json: [{ id: ids.citation, source_title: 'Release 4 Plan', source_type: 'project_governance_doc', confidence: 0.95 }] });
      return;
    }
    if (path.endsWith('/ai-knowledge-citations') && request.method() === 'POST') {
      await route.fulfill({ json: { id: ids.citation, ...payload } });
      return;
    }

    await route.fulfill({ json: [] });
  });

  await page.goto('/primetime/ai-assistance');
  await expect(page.getByRole('heading', { name: 'AI Assistance Control Plane' })).toBeVisible();
  await expect(page.getByTestId('ai-governance-boundary')).toContainText('no quote');

  await page.getByRole('button', { name: 'Create Intake Agent' }).click();
  await page.getByRole('button', { name: 'Create Agent Version' }).click();
  await page.getByRole('button', { name: 'Create Meeting Prep Request' }).click();
  await page.getByRole('button', { name: 'Create Draft Output' }).click();
  await page.getByRole('button', { name: 'Propose Safe Task' }).click();
  await page.getByRole('button', { name: 'Record Blocked Recommendation' }).click();
  await page.getByRole('button', { name: 'Create Licensed Approval' }).click();
  await page.getByRole('button', { name: 'Record Finding' }).click();
  await page.getByRole('button', { name: 'Add Citation' }).click();

  await expect(page.getByTestId('ai-action-ledger')).toContainText('regulated_recommendation');
  await expect(page.getByTestId('ai-action-ledger')).toContainText('blocked');
  await expect(page.getByTestId('approval-inbox')).toContainText('licensed');
  await expect(page.getByTestId('knowledge-citations')).toContainText('PRIMETIME Release 4 AI Assistance Plan');

  expect(methods).not.toContain('DELETE');
  expect(requests.some((path) => path.includes('/send'))).toBe(false);
  expect(requests.some((path) => path.includes('/quote'))).toBe(false);
  expect(requests.some((path) => path.includes('/recommend-policy'))).toBe(false);
  expect(requests.some((path) => path.includes('/submit-application'))).toBe(false);
});
