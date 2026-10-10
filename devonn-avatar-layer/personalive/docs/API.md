# Avatar Gateway API Reference

## Base URL

```
http://localhost:8100
```

## Authentication

All endpoints except `/health` require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <DEVONN_API_KEY>
```

## Endpoints

### Health Check

```http
GET /health
```

Returns the overall system health including PersonaLive service connectivity.

**Response:**
```json
{
  "status": "healthy",
  "gateway": "running",
  "personalive": "connected",
  "active_sessions": 3
}
```

### GPU Status

```http
GET /gpu/status
```

Returns GPU utilization and memory information from the PersonaLive service.

**Response:**
```json
{
  "gpu_utilization": 45,
  "memory_used_mb": 8192,
  "memory_total_mb": 24576,
  "temperature_c": 62
}
```

### Chat (Full Pipeline)

```http
POST /chat
Content-Type: application/json
```

Executes the full avatar pipeline: message → LLM → TTS → animation → video.

**Request Body:**
```json
{
  "message": "Tell me about life insurance options",
  "session_id": "optional-existing-session-id",
  "persona": "insurance_agent"
}
```

**Response:**
```json
{
  "session_id": "abc-123-def",
  "text_response": "I'd be happy to help you explore life insurance options...",
  "audio_url": "/output/abc-123-def/audio.wav",
  "video_url": "/output/abc-123-def/video.mp4",
  "status": "completed"
}
```

### Speak (Direct TTS + Animation)

```http
POST /sessions/{session_id}/speak?text=Hello%20there
```

Makes the avatar speak specific text without going through the LLM.

**Response:**
```json
{
  "video_url": "/output/abc-123-def/video.mp4",
  "status": "completed"
}
```

### List Sessions

```http
GET /sessions
```

Returns all active avatar sessions.

**Response:**
```json
[
  {
    "session_id": "abc-123-def",
    "persona": "insurance_agent",
    "created_at": "2026-06-19T20:00:00Z",
    "status": "active",
    "duration_seconds": 120.5
  }
]
```

### Close Session

```http
DELETE /sessions/{session_id}
```

Closes an avatar session and releases GPU resources.

**Response:**
```json
{
  "status": "closed",
  "session_id": "abc-123-def"
}
```

### WebSocket Streaming

```
WS /ws/avatar/{session_id}
```

Real-time bidirectional communication for continuous avatar interaction.

**Client sends:**
```json
{"message": "What coverage do I need?"}
```

**Server responds (text first, then video):**
```json
{"type": "text", "content": "Based on your situation..."}
{"type": "video", "url": "/output/session/video.mp4", "audio_url": "/output/session/audio.wav"}
```
