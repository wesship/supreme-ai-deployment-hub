import { describe, expect, it } from "vitest";
import { canIssueVoiceSession, canUseVoiceSession, VOICE_SESSION_TTL_MS } from "../sessionPolicy";

const now = 1_800_000_000_000;
const session = {
  userId: "owner",
  sessionId: "s1",
  createdAtMs: now - 1000,
  expiresAtMs: now + 1000,
  revokedAtMs: null,
};

describe("Hermes voice session policy", () => {
  it("permits a valid unrevoked session for its owner", () => {
    expect(canUseVoiceSession(session, "owner", now)).toBe(true);
  });
  it("rejects cross-account access", () => {
    expect(canUseVoiceSession(session, "other", now)).toBe(false);
  });
  it("rejects missing, revoked, expired and future sessions", () => {
    expect(canUseVoiceSession(null, "owner", now)).toBe(false);
    expect(canUseVoiceSession({ ...session, revokedAtMs: now - 1 }, "owner", now)).toBe(false);
    expect(canUseVoiceSession({ ...session, expiresAtMs: now }, "owner", now)).toBe(false);
    expect(canUseVoiceSession({ ...session, createdAtMs: now + 1 }, "owner", now)).toBe(false);
  });
  it("rejects excessive lifetimes and invalid clocks", () => {
    expect(canUseVoiceSession({ ...session, expiresAtMs: session.createdAtMs + VOICE_SESSION_TTL_MS + 1 }, "owner", now)).toBe(false);
    expect(canUseVoiceSession(session, "owner", Number.NaN)).toBe(false);
  });
  it("enforces per-user active session cap", () => {
    expect(canIssueVoiceSession(0)).toBe(true);
    expect(canIssueVoiceSession(1)).toBe(true);
    expect(canIssueVoiceSession(2)).toBe(false);
    expect(canIssueVoiceSession(-1)).toBe(false);
    expect(canIssueVoiceSession(1.5)).toBe(false);
  });
});
