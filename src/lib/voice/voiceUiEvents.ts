/** Safe, framework-independent Hermes voice/UI event contract.
 * This module never starts a microphone, network request or agent action.
 */
import { z } from "zod";

const sessionId = z.string().uuid();
const text = z.string().trim().min(1).max(8000);
const base = z.object({ sessionId });

export const voiceUiEventSchema = z.discriminatedUnion("type", [
  base.extend({ type: z.literal("voice.session.started") }),
  base.extend({ type: z.literal("voice.transcript.partial"), text }),
  base.extend({ type: z.literal("voice.transcript.final"), text }),
  base.extend({ type: z.literal("hermes.intent.proposed"), intentId: z.string().uuid(), summary: text }),
  base.extend({ type: z.literal("hermes.action.approval_required"), intentId: z.string().uuid(), summary: text }),
  base.extend({
    type: z.literal("ui.component.proposed"),
    componentType: z.enum(["agent-status", "dependency-graph", "metric-chart", "plain-text"]),
    title: z.string().max(160),
    data: z.unknown(),
  }),
  base.extend({ type: z.literal("voice.response.text"), text }),
  base.extend({ type: z.literal("voice.session.ended"), reason: z.enum(["user", "timeout", "disconnect", "error"]) }),
]);

export type VoiceUiEvent = z.infer<typeof voiceUiEventSchema>;
export type VoiceUiEventHandler = (event: VoiceUiEvent) => void;

/** Validates untrusted events before passing them to a UI adapter. */
export function dispatchVoiceUiEvent(payload: unknown, handler: VoiceUiEventHandler): boolean {
  const result = voiceUiEventSchema.safeParse(payload);
  if (!result.success) return false;
  handler(result.data);
  return true;
}
