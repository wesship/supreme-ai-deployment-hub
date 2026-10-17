import { describe, expect, it, vi } from "vitest";
import { dispatchVoiceUiEvent, voiceUiEventSchema } from "../voiceUiEvents";

const sessionId = "4bd60640-8db2-4c27-8ee0-79f0e2e1a361";
const intentId = "33b43d5e-f3d8-4f43-b21f-dcf3970e95f5";

describe("Hermes voice UI event boundary", () => {
  it("accepts a valid final transcript", () => {
    const handler = vi.fn();
    expect(dispatchVoiceUiEvent({ type: "voice.transcript.final", sessionId, text: "Show my dashboard" }, handler)).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });
  it("rejects malformed and unknown events without invoking handler", () => {
    const handler = vi.fn();
    for (const payload of [null, {}, { type: "voice.session.started", sessionId: "invalid" }, { type: "voice.tool.execute", sessionId }]) {
      expect(dispatchVoiceUiEvent(payload, handler)).toBe(false);
    }
    expect(handler).not.toHaveBeenCalled();
  });
  it("rejects unapproved component types", () => {
    expect(voiceUiEventSchema.safeParse({
      type: "ui.component.proposed", sessionId, componentType: "arbitrary-html",
      title: "Unsafe", data: "<script>alert(1)</script>",
    }).success).toBe(false);
  });
  it("requires intent identity on approval requests", () => {
    expect(voiceUiEventSchema.safeParse({
      type: "hermes.action.approval_required", sessionId, intentId, summary: "Request approval",
    }).success).toBe(true);
    expect(voiceUiEventSchema.safeParse({
      type: "hermes.action.approval_required", sessionId, intentId: "bad", summary: "Request approval",
    }).success).toBe(false);
  });
  it("limits transcript size", () => {
    expect(voiceUiEventSchema.safeParse({
      type: "voice.transcript.final", sessionId, text: "x".repeat(8001),
    }).success).toBe(false);
  });
});
