import { describe, expect, it } from 'vitest';
import { handoffApiBase, handoffPayload, handoffSchema } from './handoffService';
import type { WorkflowMetadata } from './workflowImport';
const id = '11111111-1111-4111-8111-111111111111';
const metadata: WorkflowMetadata = {
  project: { id: 'private-source-id', title: 'My bulletin', format: 'news_anchor', contentHash: 'untrusted-hash', aspectRatio: '16:9', captions: true },
  generatedAt: '2026-10-04T00:00:00Z', overall: 'render_completed', idempotencyKey: 'private-request-key',
  stages: ['authoring', 'review', 'render', 'export'].map(stage => ({ stage, status: 'render_completed', blockers: ['private note'] })) as WorkflowMetadata['stages'],
};
describe('authenticated Studio handoff', () => {
  it('projects only title format and stage claims', () => {
    const payload = handoffPayload(metadata, id);
    expect(Object.keys(payload)).toEqual(['request_id', 'title', 'template', 'stage_claims']);
    expect(JSON.stringify(payload)).not.toMatch(/private|untrusted/);
    expect(payload.stage_claims[0]).toEqual({ stage: 'authoring', status: 'render_completed' });
  });
  it('rejects unknown template', () => expect(() => handoffPayload({ ...metadata, project: { ...metadata.project, format: 'alien' } }, id)).toThrow());
  it('rejects blank title and invalid request id', () => {
    expect(() => handoffPayload(metadata, 'bad')).toThrow();
    expect(() => handoffPayload({ ...metadata, project: { ...metadata.project, title: '  ' } }, id)).toThrow();
  });
  it.each(['https://evil.example', 'https://api.d3vonn.io.evil.example', 'https://api.d3vonn.io/path', 'https://user:pass@api.d3vonn.io', 'http://api.d3vonn.io', 'https://api.d3vonn.io?key=secret'])('rejects token destination %s', base => {
    expect(() => handoffApiBase(base, 'https://d3vonn.io', false)).toThrow();
  });
  it('allows verified canonical origins and development localhost', () => {
    expect(handoffApiBase('https://api.d3vonn.io', 'https://d3vonn.io', false)).toBe('https://api.d3vonn.io');
    expect(handoffApiBase('http://localhost:8000', 'http://localhost:5173', true)).toBe('http://localhost:8000');
    expect(() => handoffApiBase('http://localhost:8000', 'https://d3vonn.io', false)).toThrow();
  });
  it('refuses a server success that claims execution or approval', () => {
    const response = { id, status: 'draft', execution: 'blocked', content_hash: 'a'.repeat(64), template: 'news_anchor', blockers: [] };
    expect(handoffSchema.safeParse(response).success).toBe(true);
    expect(handoffSchema.safeParse({ ...response, status: 'approved' }).success).toBe(false);
    expect(handoffSchema.safeParse({ ...response, execution: 'running' }).success).toBe(false);
  });
});
