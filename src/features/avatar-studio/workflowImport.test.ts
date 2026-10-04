import { describe, expect, it } from 'vitest';
import { parseWorkflowMetadata } from './workflowImport';
const fixture = () => ({
  format: 'd3vonn.workflow-manifest', version: 1, generatedAt: '2026-10-04T00:00:00Z', idempotencyKey: 'abcdefgh',
  project: { id: 'p1', title: '<script>alert(1)</script>', format: 'teacher_lesson', aspectRatio: '16:9', captions: true, contentHash: 'hash' }, overall: 'draft',
  stages: ['authoring', 'review', 'render', 'export'].map(stage => ({ stage, status: 'draft', blockers: [] })),
  render: { completedJobIds: ['private-job'], executionSignaled: false },
  content: { segments: [{ id: 's1', text: 'private script', direction: 'private direction' }], objectives: ['private objective'] },
  privacy: { includesContent: true, excludes: ['media'] },
});
describe('Studio workflow metadata import', () => {
  it('projects an exact Studio-compatible fixture without content or job identifiers', () => {
    const parsed = parseWorkflowMetadata(JSON.stringify(fixture()));
    expect(parsed.project.title).toBe('<script>alert(1)</script>');
    expect(JSON.stringify(parsed)).not.toMatch(/private|executionSignaled/);
  });
  it('accepts the default metadata-only export', () => {
    const f = { ...fixture(), content: null, privacy: { includesContent: false, excludes: ["media"] } };
    expect(parseWorkflowMetadata(JSON.stringify(f)).stages).toHaveLength(4);
  });
  it.each(['version', 'execution', 'duplicate', 'mismatch', 'extra'])('rejects invalid contract %s', mode => {
    const f = fixture();
    if (mode === 'version') f.version = 2;
    if (mode === 'execution') f.render.executionSignaled = true;
    if (mode === 'duplicate') f.stages[1].stage = 'authoring';
    if (mode === 'mismatch') f.privacy.includesContent = false;
    if (mode === 'extra') Object.assign(f.project, { voiceRef: 'secret' });
    expect(() => parseWorkflowMetadata(JSON.stringify(f))).toThrow();
  });
  it('rejects oversized or non-JSON input', () => {
    expect(() => parseWorkflowMetadata('x'.repeat(2 * 1024 * 1024 + 1))).toThrow('2 MB');
    expect(() => parseWorkflowMetadata('not JSON')).toThrow();
  });
});
