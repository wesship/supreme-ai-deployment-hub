/**
 * DevonnAvatar — React Component for Devonn.AI Digital Human Interface
 *
 * Renders a real-time animated avatar that responds to user messages.
 * Connects to the Avatar Gateway via WebSocket for streaming interaction.
 *
 * Usage:
 * ```tsx
 * import { DevonnAvatar } from '@devonn/avatar-layer';
 *
 * <DevonnAvatar
 *   gatewayUrl="http://localhost:8100"
 *   persona="insurance_agent"
 *   onMessage={(msg) => console.log(msg)}
 * />
 * ```
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DevonnAvatarProps {
  /** URL of the Avatar Gateway service */
  gatewayUrl: string;
  /** Avatar persona to use (e.g., "insurance_agent", "ai_tutor") */
  persona?: string;
  /** Session ID for resuming existing sessions */
  sessionId?: string;
  /** Callback when the avatar sends a text response */
  onMessage?: (message: string) => void;
  /** Callback when connection status changes */
  onStatusChange?: (status: AvatarStatus) => void;
  /** Custom CSS class for the container */
  className?: string;
  /** Whether to show the chat input */
  showInput?: boolean;
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Width of the avatar display */
  width?: number | string;
  /** Height of the avatar display */
  height?: number | string;
}

type AvatarStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "speaking"
  | "thinking"
  | "error";

interface AvatarMessage {
  role: "user" | "avatar";
  content: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DevonnAvatar: React.FC<DevonnAvatarProps> = ({
  gatewayUrl,
  persona = "default",
  sessionId,
  onMessage,
  onStatusChange,
  className = "",
  showInput = true,
  autoConnect = true,
  width = 512,
  height = 512,
}) => {
  const [status, setStatus] = useState<AvatarStatus>("disconnected");
  const [messages, setMessages] = useState<AvatarMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId || "");

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update status and notify parent
  const updateStatus = useCallback(
    (newStatus: AvatarStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Connect to Avatar Gateway WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    updateStatus("connecting");

    const wsUrl = gatewayUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");

    const sid = currentSessionId || crypto.randomUUID();
    setCurrentSessionId(sid);

    const ws = new WebSocket(`${wsUrl}/ws/avatar/${sid}`);

    ws.onopen = () => {
      updateStatus("connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "text") {
        const message: AvatarMessage = {
          role: "avatar",
          content: data.content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, message]);
        onMessage?.(data.content);
        updateStatus("speaking");
      }

      if (data.type === "video") {
        setVideoUrl(data.url);
        // Play the video
        if (videoRef.current && data.url) {
          videoRef.current.src = `${gatewayUrl}${data.url}`;
          videoRef.current.play().catch(() => {});
        }
      }
    };

    ws.onclose = () => {
      updateStatus("disconnected");
    };

    ws.onerror = () => {
      updateStatus("error");
    };

    wsRef.current = ws;
  }, [gatewayUrl, currentSessionId, updateStatus, onMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    updateStatus("disconnected");
  }, [updateStatus]);

  // Send a message to the avatar
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !wsRef.current) return;

      const message: AvatarMessage = {
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, message]);
      updateStatus("thinking");

      wsRef.current.send(JSON.stringify({ message: text }));
    },
    [updateStatus]
  );

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
    setInputText("");
  };

  // Handle video ended
  const handleVideoEnded = () => {
    updateStatus("connected");
  };

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={`devonn-avatar-container ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        width: typeof width === "number" ? `${width}px` : width,
      }}
    >
      {/* Avatar Video Display */}
      <div
        className="devonn-avatar-display"
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          height: typeof height === "number" ? `${height}px` : height,
          borderRadius: "1rem",
          overflow: "hidden",
          background: "#1a1a2e",
          position: "relative",
        }}
      >
        <video
          ref={videoRef}
          onEnded={handleVideoEnded}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          playsInline
          muted={false}
        />

        {/* Status Indicator */}
        <div
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.25rem 0.75rem",
            borderRadius: "1rem",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: "0.75rem",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background:
                status === "connected" || status === "speaking"
                  ? "#4ade80"
                  : status === "thinking"
                  ? "#fbbf24"
                  : status === "error"
                  ? "#ef4444"
                  : "#6b7280",
            }}
          />
          {status}
        </div>
      </div>

      {/* Chat Input */}
      {showInput && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: "0.5rem",
            width: "100%",
          }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            disabled={status === "disconnected" || status === "error"}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #e5e7eb",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={
              !inputText.trim() ||
              status === "disconnected" ||
              status === "error"
            }
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              background: "#6366f1",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Send
          </button>
        </form>
      )}

      {/* Message History (optional) */}
      {messages.length > 0 && (
        <div
          className="devonn-avatar-messages"
          style={{
            width: "100%",
            maxHeight: "200px",
            overflowY: "auto",
            padding: "0.5rem",
            borderRadius: "0.5rem",
            background: "#f9fafb",
          }}
        >
          {messages.slice(-5).map((msg, i) => (
            <div
              key={i}
              style={{
                padding: "0.5rem",
                marginBottom: "0.25rem",
                borderRadius: "0.375rem",
                background: msg.role === "user" ? "#e0e7ff" : "#f0fdf4",
                fontSize: "0.8rem",
              }}
            >
              <strong>{msg.role === "user" ? "You" : persona}:</strong>{" "}
              {msg.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DevonnAvatar;
