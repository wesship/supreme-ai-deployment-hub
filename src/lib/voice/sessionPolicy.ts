/** Pure, fail-closed session policy for the future Hermes voice gateway.
 * All timestamps must originate from the trusted server, not the browser.
 */
export type VoiceSessionRecord = {
  userId: string;
  sessionId: string;
  createdAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
};
export const VOICE_SESSION_TTL_MS = 5 * 60 * 1000;
export const MAX_ACTIVE_VOICE_SESSIONS_PER_USER = 2;

export function canUseVoiceSession(
  record: VoiceSessionRecord | null,
  authenticatedUserId: string,
  nowMs: number,
): boolean {
  return Boolean(
    record &&
    authenticatedUserId &&
    record.userId === authenticatedUserId &&
    Number.isFinite(nowMs) &&
    Number.isFinite(record.createdAtMs) &&
    Number.isFinite(record.expiresAtMs) &&
    record.revokedAtMs === null &&
    record.createdAtMs <= nowMs &&
    record.expiresAtMs > nowMs &&
    record.expiresAtMs - record.createdAtMs <= VOICE_SESSION_TTL_MS,
  );
}

export function canIssueVoiceSession(activeCount: number): boolean {
  return Number.isInteger(activeCount) &&
    activeCount >= 0 &&
    activeCount < MAX_ACTIVE_VOICE_SESSIONS_PER_USER;
}
