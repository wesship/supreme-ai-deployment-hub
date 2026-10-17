import { canUseVoiceSession, type VoiceSessionRecord } from "./sessionPolicy";

/** Server-side authorization boundary. The loader must query trusted persistent storage. */
export async function authorizeVoiceAction(
  sessionId: string,
  authenticatedUserId: string,
  loadSession: (sessionId: string) => Promise<VoiceSessionRecord | null>,
  nowMs: number,
): Promise<boolean> {
  if (!sessionId || !authenticatedUserId || !Number.isFinite(nowMs)) return false;
  try {
    const session = await loadSession(sessionId);
    return session?.sessionId === sessionId &&
      canUseVoiceSession(session, authenticatedUserId, nowMs);
  } catch {
    // Fail closed on database/network failures.
    return false;
  }
}
