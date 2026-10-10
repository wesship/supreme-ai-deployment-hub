export type DemoStageStatus = 'complete' | 'active' | 'pending' | 'approval';

export interface DemoStage {
  id: string;
  title: string;
  owner: string;
  detail: string;
  status: DemoStageStatus;
}

export const ACME_DEMO_GOAL =
  'Research Acme Manufacturing, prepare an executive opportunity brief, draft personalized outreach, route it through compliance, and submit the package for human approval.';

export const ACME_DEMO_STAGES: DemoStage[] = [
  { id: 'intake', title: 'Goal intake', owner: 'Hermes', detail: 'Goal normalized into a measurable execution plan.', status: 'complete' },
  { id: 'research', title: 'Prospect research', owner: 'Research Scout', detail: 'Six fictional knowledge sources reviewed and cited.', status: 'complete' },
  { id: 'analysis', title: 'Opportunity analysis', owner: 'Market Intelligence', detail: 'Operational priorities and buying signals summarized.', status: 'complete' },
  { id: 'draft', title: 'Executive brief', owner: 'Communications Agent', detail: 'Brief and outreach package prepared from grounded evidence.', status: 'complete' },
  { id: 'compliance', title: 'Compliance review', owner: 'Compliance Reviewer', detail: 'Claims, tone, and external-action boundaries checked.', status: 'complete' },
  { id: 'approval', title: 'Human approval', owner: 'Human operator', detail: 'Consequential external delivery is paused for review.', status: 'approval' },
  { id: 'delivery', title: 'Final delivery', owner: 'Hermes', detail: 'Simulation package is released only after approval.', status: 'pending' },
];

export const ACME_DEMO_METRICS = [
  { label: 'Agents coordinated', value: '4' },
  { label: 'Tasks completed', value: '6 / 7' },
  { label: 'Sources reviewed', value: '6' },
  { label: 'Approvals recorded', value: '0 / 1' },
];

export const ACME_DEMO_SOURCES = [
  '2026 Operations Strategy — Simulation',
  'Plant Modernization Brief — Simulation',
  'Supplier Risk Summary — Simulation',
  'Customer Support Trends — Simulation',
  'Executive Meeting Notes — Simulation',
  'Product Portfolio Overview — Simulation',
];

export const resetAcmeDemo = () => ({
  stages: ACME_DEMO_STAGES.map((stage) => ({ ...stage })),
  approved: false,
  resetAt: new Date().toISOString(),
});
