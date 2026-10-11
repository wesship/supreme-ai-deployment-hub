import { z } from 'zod';
const text = z.string().max(5000);
const statuses = z.enum(['draft', 'review', 'ready', 'render_blocked', 'render_completed', 'exported']);
const schema = z.object({
  format: z.literal('d3vonn.workflow-manifest'), version: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }), idempotencyKey: z.string().min(8).max(256),
  project: z.object({ id: text, title: text, format: text, aspectRatio: text, captions: z.boolean(), contentHash: text }).strict(),
  overall: statuses,
  stages: z.array(z.object({ stage: z.enum(['authoring', 'review', 'render', 'export']), status: statuses, blockers: z.array(text).max(100) }).strict()).length(4),
  render: z.object({ completedJobIds: z.array(text).max(1000), executionSignaled: z.literal(false) }).strict(),
  content: z.object({ segments: z.array(z.object({ id: text, text: text, direction: text }).strict()).max(500), objectives: z.array(text).max(100) }).strict().nullable(),
  privacy: z.object({ includesContent: z.boolean(), excludes: z.array(text).max(100) }).strict(),
}).strict();
export function parseWorkflowMetadata(input: string) {
  if (new TextEncoder().encode(input).length > 2 * 1024 * 1024) throw new Error('Workflow file exceeds 2 MB.');
  const parsed = schema.parse(JSON.parse(input));
  if (new Set(parsed.stages.map(s => s.stage)).size !== 4) throw new Error('Workflow stages must be unique.');
  if (parsed.privacy.includesContent !== (parsed.content !== null)) throw new Error('Content declaration does not match package.');
  // Imported states are unverified file claims; discard scripts, directions, objectives and job IDs.
  return { project: parsed.project, generatedAt: parsed.generatedAt, overall: parsed.overall, stages: parsed.stages, idempotencyKey: parsed.idempotencyKey };
}
export type WorkflowMetadata = ReturnType<typeof parseWorkflowMetadata>;
