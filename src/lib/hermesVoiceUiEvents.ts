/** Hermes voice-to-UI event validation. No microphone or privileged execution. */
import { z } from 'zod';

const sessionId = z.string().uuid();
const text = z.string().trim().min(1).max(8000);
const base = z.object({ sessionId });

export const hermesVoiceUiEventSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('voice.session.started') }),
  base.extend({ type: z.literal('voice.transcript.partial'), text }),
  base.extend({ type: z.literal('voice.transcript.final'), text }),
  base.extend({ type: z.literal('hermes.intent.proposed'), intentId: z.string().uuid(), tool: z.string().min(1).max(100), arguments: z.record(z.string(), z.unknown()) }),
  base.extend({ type: z.literal('hermes.action.approval_required'), intentId: z.string().uuid(), summary: text }),
  base.extend({ type: z.literal('ui.component.proposed'), componentType: z.enum(['agent-status', 'dependency-graph', 'metric-chart', 'text-panel']), props: z.record(z.string(), z.unknown()), dataSource: z.string().min(1).max(200) }),
  base.extend({ type: z.literal('voice.response.text'), text }),
  base.extend({ type: z.literal('voice.session.ended'), reason: z.enum(['completed', 'cancelled', 'timeout', 'error']) }),
]);
export type HermesVoiceUiEvent = z.infer<typeof hermesVoiceUiEventSchema>;

export function parseHermesVoiceUiEvent(input: unknown): HermesVoiceUiEvent | null {
  const result = hermesVoiceUiEventSchema.safeParse(input);
  return result.success ? result.data : null;
}
