import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const page = readFileSync('src/pages/PrimetimeExecutiveCommandCenter.tsx', 'utf8');
const api = readFileSync('src/lib/primetimeRelease1Api.ts', 'utf8');

describe('PRIMETIME Release 5 Executive Command Center static coverage', () => {
  it('registers release 5 routes', () => {
    expect(app).toContain('PrimetimeExecutiveCommandCenter');
    expect(app).toContain('path="/primetime/executive-command-center"');
    expect(app).toContain('path="/primetime/release-5"');
  });

  it('exposes analytics api client methods', () => {
    expect(api).toContain('/primetime/v1/analytics/metric-definitions');
    expect(api).toContain('/primetime/v1/analytics/executive-dashboards');
    expect(api).toContain('/primetime/v1/analytics/dashboard-widgets');
    expect(api).toContain('/primetime/v1/analytics/snapshots');
    expect(api).toContain('/primetime/v1/analytics/funnel-stage-snapshots');
    expect(api).toContain('/primetime/v1/analytics/agent-performance-snapshots');
    expect(api).toContain('/primetime/v1/analytics/compliance-metric-snapshots');
    expect(api).toContain('/primetime/v1/analytics/ai-action-metric-snapshots');
    expect(api).toContain('/primetime/v1/analytics/release-governance-observations');
  });

  it('renders all command center surfaces', () => {
    expect(page).toContain('Executive Command Center');
    expect(page).toContain('Metric definition manager');
    expect(page).toContain('Dashboard builder');
    expect(page).toContain('Analytics snapshots');
    expect(page).toContain('Funnel metrics view');
    expect(page).toContain('Agent performance view');
    expect(page).toContain('Compliance metrics view');
    expect(page).toContain('AI action metrics view');
    expect(page).toContain('Release governance observations');
  });

  it('documents no-send no-delete and analytics-only boundaries', () => {
    expect(page).toContain('No send, quote, policy recommendation, application submission, autonomous execution, CRM mutation, or hard-delete behavior');
    expect(page).toContain('observation records only');
    expect(page).toContain('without mutating CRM, scheduling, communications, or AI business records');
    expect(api).not.toContain("method: 'DELETE'");
    expect(api).not.toContain('/send');
    expect(api).not.toContain('/quote');
    expect(api).not.toContain('/recommend-policy');
    expect(api).not.toContain('/submit-application');
  });
});
