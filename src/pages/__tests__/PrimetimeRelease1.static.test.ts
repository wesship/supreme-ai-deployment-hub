import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const APP = readFileSync('src/App.tsx', 'utf8');
const PAGE = readFileSync('src/pages/PrimetimeRelease1.tsx', 'utf8');
const API = readFileSync('src/lib/primetimeRelease1Api.ts', 'utf8');
const FORMS = readFileSync('src/components/primetime/PrimetimeRelease1Forms.tsx', 'utf8');

describe('PRIMETIME Release 1 UI wiring', () => {
  it('registers the PRIMETIME routes', () => {
    expect(APP).toContain('PrimetimeRelease1');
    expect(APP).toContain('path="/primetime"');
    expect(APP).toContain('path="/primetime/release-1"');
  });

  it('uses the governed Release 1 API surface', () => {
    expect(API).toContain('/primetime/v1/workspaces');
    expect(API).toContain('/primetime/v1/dashboard/daily');
    expect(API).toContain('/primetime/v1/people/duplicates');
    expect(API).toContain('/primetime/v1/pipeline-stages');
    expect(API).toContain('/primetime/v1/exceptions');
    expect(API).toContain('/primetime/v1/consent-records');
    expect(API).toContain('/primetime/v1/suppression-records');
    expect(API).toContain('method: \'POST\'');
    expect(API).toContain('supabase.auth.getSession');
    expect(API).toContain('Authorization: `Bearer ${token}`');
  });

  it('exposes the core Release 1 screens', () => {
    expect(PAGE).toContain('Governed CRM Workspace');
    expect(PAGE).toContain('PrimetimeRelease1Forms');
    expect(PAGE).toContain('Lead pipeline');
    expect(PAGE).toContain('Exception queue');
    expect(PAGE).toContain('People search');
    expect(PAGE).toContain('Duplicate review');
    expect(PAGE).toContain('Daily operating queue');
  });

  it('exposes controlled create forms without delete actions', () => {
    expect(FORMS).toContain('Create person');
    expect(FORMS).toContain('Create lead');
    expect(FORMS).toContain('Create task');
    expect(FORMS).toContain('Record activity');
    expect(FORMS).toContain('Record consent');
    expect(FORMS).toContain('Create suppression record');
    expect(FORMS).toContain('owner_id: userId');
    expect(FORMS.toLowerCase()).not.toContain('delete');
  });
});