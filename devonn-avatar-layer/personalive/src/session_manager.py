"""
Session Manager
================
Manages avatar session lifecycle including creation, tracking,
idle timeout, and resource cleanup.
"""

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Default avatar reference image (placeholder)
DEFAULT_REFERENCE_IMAGE = "config/avatars/default_portrait.png"


@dataclass
class AvatarSession:
    """Represents an active avatar interaction session."""

    session_id: str
    persona: str
    reference_image_path: str
    voice_provider: str = "openai"
    voice_id: str = "alloy"
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    message_count: int = 0
    status: str = "active"

    @property
    def duration_seconds(self) -> float:
        return time.time() - self.created_at

    @property
    def idle_seconds(self) -> float:
        return time.time() - self.last_activity

    def touch(self):
        """Update last activity timestamp."""
        self.last_activity = time.time()
        self.message_count += 1

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "persona": self.persona,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self.created_at)),
            "status": self.status,
            "duration_seconds": self.duration_seconds,
            "message_count": self.message_count,
        }


# Persona configurations mapping
PERSONA_CONFIGS = {
    "default": {
        "reference_image": DEFAULT_REFERENCE_IMAGE,
        "voice_provider": "openai",
        "voice_id": "alloy",
    },
    "insurance_agent": {
        "reference_image": "config/avatars/insurance_agent_portrait.png",
        "voice_provider": "elevenlabs",
        "voice_id": "pNInz6obpgDQGcFmaJgB",
    },
    "ai_tutor": {
        "reference_image": "config/avatars/tutor_portrait.png",
        "voice_provider": "openai",
        "voice_id": "nova",
    },
    "support_agent": {
        "reference_image": "config/avatars/support_portrait.png",
        "voice_provider": "edge-tts",
        "voice_id": "en-US-AriaNeural",
    },
    "dashboard_assistant": {
        "reference_image": "config/avatars/dashboard_portrait.png",
        "voice_provider": "openai",
        "voice_id": "echo",
    },
}


class SessionManager:
    """Manages the lifecycle of avatar sessions."""

    def __init__(self, max_sessions: int = 20, idle_timeout: int = 300):
        self._sessions: dict[str, AvatarSession] = {}
        self._max_sessions = max_sessions
        self._idle_timeout = idle_timeout

    @property
    def active_count(self) -> int:
        """Number of currently active sessions."""
        return len(self._sessions)

    def get_or_create(
        self,
        session_id: Optional[str] = None,
        persona: str = "default",
    ) -> AvatarSession:
        """Get an existing session or create a new one."""
        # Return existing session if valid
        if session_id and session_id in self._sessions:
            session = self._sessions[session_id]
            session.touch()
            return session

        # Clean up expired sessions before creating new one
        self._cleanup_idle_sessions()

        # Check capacity
        if len(self._sessions) >= self._max_sessions:
            # Evict the oldest idle session
            oldest = min(self._sessions.values(), key=lambda s: s.last_activity)
            self.close(oldest.session_id)

        # Create new session
        new_id = session_id or str(uuid.uuid4())
        config = PERSONA_CONFIGS.get(persona, PERSONA_CONFIGS["default"])

        session = AvatarSession(
            session_id=new_id,
            persona=persona,
            reference_image_path=config["reference_image"],
            voice_provider=config["voice_provider"],
            voice_id=config["voice_id"],
        )

        self._sessions[new_id] = session
        logger.info("Created avatar session %s (persona: %s)", new_id, persona)
        return session

    def get(self, session_id: str) -> Optional[AvatarSession]:
        """Get a session by ID, or None if not found."""
        session = self._sessions.get(session_id)
        if session:
            session.touch()
        return session

    def close(self, session_id: str) -> bool:
        """Close a session and release its resources."""
        if session_id in self._sessions:
            self._sessions[session_id].status = "closed"
            del self._sessions[session_id]
            logger.info("Closed avatar session %s", session_id)
            return True
        return False

    async def close_all(self):
        """Close all active sessions (used during shutdown)."""
        session_ids = list(self._sessions.keys())
        for sid in session_ids:
            self.close(sid)
        logger.info("Closed all %d sessions", len(session_ids))

    def list_sessions(self) -> list[dict]:
        """List all active sessions with their info."""
        return [s.to_dict() for s in self._sessions.values()]

    def _cleanup_idle_sessions(self):
        """Remove sessions that have been idle beyond the timeout."""
        expired = [
            sid for sid, session in self._sessions.items()
            if session.idle_seconds > self._idle_timeout
        ]
        for sid in expired:
            self.close(sid)
        if expired:
            logger.info("Cleaned up %d idle sessions", len(expired))
