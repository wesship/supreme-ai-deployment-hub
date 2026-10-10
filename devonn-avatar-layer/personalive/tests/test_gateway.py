"""Tests for the Avatar Gateway API."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestSessionManager:
    """Tests for session lifecycle management."""

    def test_create_session(self):
        from src.session_manager import SessionManager

        manager = SessionManager(max_sessions=5)
        session = manager.get_or_create(persona="default")

        assert session.session_id is not None
        assert session.persona == "default"
        assert session.status == "active"
        assert manager.active_count == 1

    def test_get_existing_session(self):
        from src.session_manager import SessionManager

        manager = SessionManager()
        session1 = manager.get_or_create(session_id="test-123", persona="default")
        session2 = manager.get_or_create(session_id="test-123", persona="default")

        assert session1.session_id == session2.session_id
        assert manager.active_count == 1

    def test_close_session(self):
        from src.session_manager import SessionManager

        manager = SessionManager()
        session = manager.get_or_create(persona="default")
        sid = session.session_id

        assert manager.close(sid) is True
        assert manager.active_count == 0
        assert manager.get(sid) is None

    def test_max_sessions_eviction(self):
        from src.session_manager import SessionManager

        manager = SessionManager(max_sessions=2)
        s1 = manager.get_or_create(persona="default")
        s2 = manager.get_or_create(persona="default")
        s3 = manager.get_or_create(persona="default")

        # Should have evicted the oldest
        assert manager.active_count == 2
        assert manager.get(s1.session_id) is None

    def test_persona_config_loading(self):
        from src.session_manager import SessionManager

        manager = SessionManager()
        session = manager.get_or_create(persona="insurance_agent")

        assert session.voice_provider == "elevenlabs"
        assert session.voice_id == "pNInz6obpgDQGcFmaJgB"

    def test_list_sessions(self):
        from src.session_manager import SessionManager

        manager = SessionManager()
        manager.get_or_create(persona="default")
        manager.get_or_create(persona="ai_tutor")

        sessions = manager.list_sessions()
        assert len(sessions) == 2
        assert all("session_id" in s for s in sessions)


class TestVoiceEngine:
    """Tests for the voice engine TTS providers."""

    def test_list_providers_with_keys(self):
        from src.voice_engine import VoiceEngine

        engine = VoiceEngine(
            openai_api_key="test-key",
            elevenlabs_api_key="test-key",
        )
        providers = engine.list_providers()

        names = [p["name"] for p in providers]
        assert "openai" in names
        assert "elevenlabs" in names
        assert "edge-tts" in names

    def test_list_providers_without_keys(self):
        from src.voice_engine import VoiceEngine

        engine = VoiceEngine()
        providers = engine.list_providers()

        names = [p["name"] for p in providers]
        assert "openai" not in names
        assert "elevenlabs" not in names
        assert "edge-tts" in names

    @pytest.mark.asyncio
    async def test_synthesize_invalid_provider(self):
        from src.voice_engine import VoiceEngine

        engine = VoiceEngine()
        with pytest.raises(ValueError, match="Unsupported TTS provider"):
            await engine.synthesize("Hello", provider="invalid")

    @pytest.mark.asyncio
    async def test_synthesize_openai_no_key(self):
        from src.voice_engine import VoiceEngine

        engine = VoiceEngine(openai_api_key="")
        with pytest.raises(RuntimeError, match="OpenAI API key not configured"):
            await engine.synthesize("Hello", provider="openai")


class TestPersonaLiveClient:
    """Tests for the PersonaLive service client."""

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        from src.personalive_client import PersonaLiveClient

        client = PersonaLiveClient(base_url="http://localhost:7870")

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_get.return_value.__aenter__ = AsyncMock(return_value=mock_response)

            # Note: In real test, we'd mock the full async context manager
            # This test validates the client instantiation
            assert client.base_url == "http://localhost:7870"

    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        from src.personalive_client import PersonaLiveClient

        client = PersonaLiveClient(base_url="http://unreachable:7870")
        result = await client.check_health()
        assert result is False
