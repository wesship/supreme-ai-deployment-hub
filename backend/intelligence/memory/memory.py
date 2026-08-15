"""
Devonn.ai Memory Module

Provides short-term (in-process) and long-term (Supabase-backed) memory
for agents and conversations. Supports context window management.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

MAX_SHORT_TERM_MESSAGES = 50  # Per-session message limit


class MemoryEntry(BaseModel):
    entry_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str  # "user" | "assistant" | "system" | "tool"
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: float = Field(default_factory=time.time)


class ConversationMemory:
    """
    Short-term in-process conversation memory.
    Stores message history per session with a rolling window.
    """

    def __init__(self):
        self._sessions: Dict[str, List[MemoryEntry]] = {}

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> MemoryEntry:
        """Add a message to a session's memory."""
        entry = MemoryEntry(
            session_id=session_id,
            role=role,
            content=content,
            metadata=metadata or {}
        )
        if session_id not in self._sessions:
            self._sessions[session_id] = []

        self._sessions[session_id].append(entry)

        # Rolling window: keep only the last N messages
        if len(self._sessions[session_id]) > MAX_SHORT_TERM_MESSAGES:
            self._sessions[session_id] = self._sessions[session_id][-MAX_SHORT_TERM_MESSAGES:]

        return entry

    def get_history(
        self,
        session_id: str,
        max_messages: int = 20
    ) -> List[Dict[str, str]]:
        """Get conversation history as OpenAI-compatible message list."""
        entries = self._sessions.get(session_id, [])
        recent = entries[-max_messages:]
        return [{"role": e.role, "content": e.content} for e in recent]

    def clear_session(self, session_id: str) -> None:
        """Clear memory for a session."""
        self._sessions.pop(session_id, None)

    def session_count(self) -> int:
        """Return the number of active sessions."""
        return len(self._sessions)


class LongTermMemory:
    """
    Long-term memory backed by Supabase.
    Stores important facts, summaries, and agent learnings.
    """

    def __init__(self, supabase_client=None):
        self._client = supabase_client
        self._local_store: Dict[str, Any] = {}  # Fallback when Supabase is not configured

    def set_client(self, client) -> None:
        """Set the Supabase client after initialization."""
        self._client = client

    async def store(
        self,
        key: str,
        value: Any,
        user_id: Optional[str] = None,
        ttl_seconds: Optional[int] = None
    ) -> bool:
        """Store a key-value fact in long-term memory."""
        entry = {
            "key": key,
            "value": value,
            "user_id": user_id,
            "stored_at": time.time(),
            "expires_at": time.time() + ttl_seconds if ttl_seconds else None
        }

        if self._client is None:
            # Fallback to local store
            self._local_store[key] = entry
            logger.debug("Long-term memory stored locally")
            return True

        try:
            self._client.table("agent_memory").upsert({
                "key": key,
                "value": str(value),
                "user_id": user_id,
                "expires_at": entry["expires_at"]
            }).execute()
            return True
        except Exception as exc:
            logger.error("Failed to store long-term memory: %s", exc)
            self._local_store[key] = entry
            return False

    async def retrieve(self, key: str, user_id: Optional[str] = None) -> Optional[Any]:
        """Retrieve a value from long-term memory."""
        if self._client is None:
            entry = self._local_store.get(key)
            if entry:
                # Check TTL
                if entry.get("expires_at") and time.time() > entry["expires_at"]:
                    del self._local_store[key]
                    return None
                return entry["value"]
            return None

        try:
            query = self._client.table("agent_memory").select("value").eq("key", key)
            if user_id:
                query = query.eq("user_id", user_id)
            result = query.execute()
            if result.data:
                return result.data[0]["value"]
            return None
        except Exception as exc:
            logger.error("Failed to retrieve long-term memory: %s", exc)
            return self._local_store.get(key, {}).get("value")

    async def search(self, prefix: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Search memory by key prefix."""
        if self._client is None:
            return {k: v["value"] for k, v in self._local_store.items() if k.startswith(prefix)}

        try:
            query = self._client.table("agent_memory").select("key, value").like("key", f"{prefix}%")
            if user_id:
                query = query.eq("user_id", user_id)
            result = query.execute()
            return {row["key"]: row["value"] for row in result.data}
        except Exception as exc:
            logger.error("Failed to search long-term memory: %s", exc)
            return {}


# Global singleton instances
conversation_memory = ConversationMemory()
long_term_memory = LongTermMemory()
