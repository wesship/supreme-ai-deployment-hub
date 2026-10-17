import { describe, expect, it, vi } from "vitest";
import { dispatchBoundVoiceUiEvent } from "../boundEventDispatcher";

const sessionId = "4bd60640-8db2-4c27-8ee0-79f0e2e1a361";
const otherSession = "3a750cc0-51aa-4a55-bacb-8864ccca54a1";

describe("voice UI session isolation", () => {
  it("dispatches valid events belonging to the active session", () => {
    const handler = vi.fn();
    expect(dispatchBoundVoiceUiEvent({ type: "voice.transcript.final", sessionId, text: "Hello" }, sessionId, handler)).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });
  it("rejects cross-session events, malformed events and absent session bindings", () => {
    const handler = vi.fn();
    expect(dispatchBoundVoiceUiEvent({ type: "voice.response.text", sessionId: otherSession, text: "Private" }, sessionId, handler)).toBe(false);
    expect(dispatchBoundVoiceUiEvent({ type: "voice.response.text", sessionId, text: "Hello" }, "", handler)).toBe(false);
    expect(dispatchBoundVoiceUiEvent({ type: "untrusted.execute", sessionId }, sessionId, handler)).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
