import { voiceUiEventSchema, type VoiceUiEvent, type VoiceUiEventHandler } from "./voiceUiEvents";

/** Enforces session isolation before dispatching untrusted voice events.
 * Approval-required events are notifications, never permission to execute tools.
 */
export function dispatchBoundVoiceUiEvent(
  payload: unknown,
  expectedSessionId: string,
  handler: VoiceUiEventHandler,
): boolean {
  if (!expectedSessionId) return false;
  const parsed = voiceUiEventSchema.safeParse(payload);
  if (!parsed.success || parsed.data.sessionId !== expectedSessionId) return false;
  handler(parsed.data as VoiceUiEvent);
  return true;
}
