/**
 * useAvatarSession — React Hook for Avatar Gateway interaction
 *
 * Provides a programmatic interface for controlling the avatar
 * without using the full DevonnAvatar component.
 *
 * Usage:
 * ```tsx
 * const { sendMessage, status, lastResponse } = useAvatarSession({
 *   gatewayUrl: "http://localhost:8100",
 *   persona: "ai_tutor",
 * });
 *
 * await sendMessage("Explain quantum physics");
 * ```
 */

import { useCallback, useRef, useState } from "react";

interface UseAvatarSessionOptions {
  gatewayUrl: string;
  persona?: string;
  sessionId?: string;
}

interface AvatarResponse {
  sessionId: string;
  textResponse: string;
  audioUrl: string | null;
  videoUrl: string | null;
  status: string;
}

type SessionStatus = "idle" | "loading" | "speaking" | "error";

export function useAvatarSession(options: UseAvatarSessionOptions) {
  const { gatewayUrl, persona = "default", sessionId } = options;

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [lastResponse, setLastResponse] = useState<AvatarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentSessionId = useRef(sessionId || "");

  /**
   * Send a message to the avatar via the REST API (non-streaming).
   */
  const sendMessage = useCallback(
    async (message: string): Promise<AvatarResponse | null> => {
      setStatus("loading");
      setError(null);

      try {
        const response = await fetch(`${gatewayUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            session_id: currentSessionId.current || undefined,
            persona,
          }),
        });

        if (!response.ok) {
          throw new Error(`Gateway error: ${response.status}`);
        }

        const data: AvatarResponse = await response.json();
        currentSessionId.current = data.sessionId;
        setLastResponse(data);
        setStatus("speaking");

        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        setStatus("error");
        return null;
      }
    },
    [gatewayUrl, persona]
  );

  /**
   * Make the avatar speak specific text (bypasses LLM).
   */
  const speak = useCallback(
    async (text: string) => {
      if (!currentSessionId.current) {
        setError("No active session");
        return null;
      }

      setStatus("loading");

      try {
        const response = await fetch(
          `${gatewayUrl}/sessions/${currentSessionId.current}/speak?text=${encodeURIComponent(text)}`,
          { method: "POST" }
        );

        if (!response.ok) {
          throw new Error(`Speak error: ${response.status}`);
        }

        const data = await response.json();
        setStatus("speaking");
        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        setStatus("error");
        return null;
      }
    },
    [gatewayUrl]
  );

  /**
   * Close the current avatar session.
   */
  const closeSession = useCallback(async () => {
    if (!currentSessionId.current) return;

    try {
      await fetch(`${gatewayUrl}/sessions/${currentSessionId.current}`, {
        method: "DELETE",
      });
      currentSessionId.current = "";
      setStatus("idle");
      setLastResponse(null);
    } catch {
      // Best effort cleanup
    }
  }, [gatewayUrl]);

  return {
    sendMessage,
    speak,
    closeSession,
    status,
    lastResponse,
    error,
    sessionId: currentSessionId.current,
  };
}
