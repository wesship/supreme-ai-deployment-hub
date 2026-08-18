import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const page = readFileSync('src/pages/PrimetimeObservability.tsx', 'utf8');
const api = readFileSync('src/lib/primetimeRelease1Api.ts', 'utf8');

describe('PRIMETIME Release 7 observability static coverage', () => {
  it('registers authenticated Release 7 observability routes', () => {
    expect(app).toContain('PrimetimeObservability');
    expect(app).toContain('path="/primetime/observability" element={<AuthenticatedRoute><PrimetimeObservability /></AuthenticatedRoute>}');
    expect(app).toContain('path="/primetime/release-7" element={<AuthenticatedRoute><PrimetimeObservability /></AuthenticatedRoute>}');
  });

  it('exposes the governed telemetry client contract', () => {
    for (const endpoint of [
      '/primetime/v1/observability/overview',
      '/primetime/v1/observability/signals',
      '/primetime/v1/observability/slos',
      '/primetime/v1/observability/evaluations',
      '/primetime/v1/observability/alerts',
    ]) {
      expect(api).toContain(endpoint);
    }
  });

  it('renders telemetry, SLO, evaluation, and alert lifecycle controls', () => {
    for (const surface of [
      'Advanced Telemetry &amp; Observability',
      'Record governed signal',
      'Create SLO contract',
      'SLO evaluation desk',
      'Alert lifecycle',
      'Recent signal stream',
    ]) {
      expect(page).toContain(surface);
    }
  });

  it('documents production boundaries and does not add prohibited client actions', () => {
    expect(page).toContain('No customer payloads, message bodies, credentials, or raw requests may enter this surface');
    expect(page).toContain('no sending, quote, policy, application, autonomous execution, CRM mutation, or delete behavior');
    expect(api).not.toContain("method: 'DELETE'");
    expect(api).not.toContain('/send');
    expect(api).not.toContain('/quote');
    expect(api).not.toContain('/recommend-policy');
    expect(api).not.toContain('/submit-application');
  });
});
