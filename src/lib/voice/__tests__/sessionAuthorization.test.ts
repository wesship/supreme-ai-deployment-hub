import { describe, expect, it, vi } from "vitest";
import { authorizeVoiceAction } from "../sessionAuthorization";
import { VOICE_SESSION_TTL_MS, type VoiceSessionRecord } from "../sessionPolicy";

const now = 1_800_000_000_000;
const record: VoiceSessionRecord = {
  userId: "owner",
  sessionId: "voice-session",
  createdAtMs: now - 1000,
  expiresAtMs: now - 1000 + VOICE_SESSION_TTL_MS,
  revokedAtMs: null,
};

describe("voice action authorization boundary", () => {
  it("permits an active owned session", async () => {
    expect(await authorizeVoiceAction("voice-session", "owner", async () => record, now)).toBe(true);
  });
  it("denies cross-account and cross-session attempts", async () => {
    expect(await authorizeVoiceAction("voice-session", "other", async () => record, now)).toBe(false);
    expect(await authorizeVoiceAction("wrong", "owner", async () => record, now)).toBe(false);
  });
  it("denies expired and revoked sessions", async () => {
    expect(await authorizeVoiceAction("voice-session", "owner", async () => ({ ...record, expiresAtMs: now }), now)).toBe(false);
    expect(await authorizeVoiceAction("voice-session", "owner", async () => ({ ...record, revokedAtMs: now - 1 }), now)).toBe(false);
  });
  it("denies missing sessions and database failures", async () => {
    expect(await authorizeVoiceAction("voice-session", "owner", async () => null, now)).toBe(false);
    const loader = vi.fn(async (): Promise<VoiceSessionRecord | null> => { throw new Error("database unavailable"); });
    expect(await authorizeVoiceAction("voice-session", "owner", loader, now)).toBe(false);
  });
});
