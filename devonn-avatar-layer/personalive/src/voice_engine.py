"""
Voice Engine
=============
Multi-provider Text-to-Speech engine for generating audio that drives
the PersonaLive avatar animation. Supports ElevenLabs, OpenAI TTS,
Edge-TTS, and Coqui TTS backends.
"""

import io
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class VoiceEngine:
    """Multi-provider TTS engine for avatar voice generation."""

    def __init__(
        self,
        openai_api_key: str = "",
        elevenlabs_api_key: str = "",
        coqui_url: str = "http://localhost:5002",
    ):
        self.openai_api_key = openai_api_key
        self.elevenlabs_api_key = elevenlabs_api_key
        self.coqui_url = coqui_url

    async def synthesize(
        self,
        text: str,
        provider: str = "openai",
        voice_id: str = "alloy",
        model: Optional[str] = None,
    ) -> bytes:
        """
        Synthesize speech from text using the specified provider.

        Args:
            text: Text to convert to speech
            provider: TTS provider (openai, elevenlabs, edge-tts, coqui)
            voice_id: Voice identifier specific to the provider
            model: Optional model override

        Returns:
            Raw audio bytes in WAV/MP3 format
        """
        if provider == "elevenlabs":
            return await self._synthesize_elevenlabs(text, voice_id, model)
        elif provider == "openai":
            return await self._synthesize_openai(text, voice_id, model)
        elif provider == "edge-tts":
            return await self._synthesize_edge_tts(text, voice_id)
        elif provider == "coqui":
            return await self._synthesize_coqui(text, voice_id)
        else:
            raise ValueError(f"Unsupported TTS provider: {provider}")

    async def _synthesize_openai(
        self, text: str, voice: str = "alloy", model: Optional[str] = None
    ) -> bytes:
        """Generate speech using OpenAI TTS API."""
        if not self.openai_api_key:
            raise RuntimeError("OpenAI API key not configured for TTS")

        tts_model = model or "tts-1"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/speech",
                json={
                    "model": tts_model,
                    "input": text,
                    "voice": voice,
                    "response_format": "wav",
                },
                headers={
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            return response.content

    async def _synthesize_elevenlabs(
        self, text: str, voice_id: str, model: Optional[str] = None
    ) -> bytes:
        """Generate speech using ElevenLabs API."""
        if not self.elevenlabs_api_key:
            raise RuntimeError("ElevenLabs API key not configured")

        eleven_model = model or "eleven_turbo_v2_5"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                json={
                    "text": text,
                    "model_id": eleven_model,
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.5,
                    },
                },
                headers={
                    "xi-api-key": self.elevenlabs_api_key,
                    "Content-Type": "application/json",
                    "Accept": "audio/wav",
                },
            )
            response.raise_for_status()
            return response.content

    async def _synthesize_edge_tts(self, text: str, voice: str = "en-US-AriaNeural") -> bytes:
        """Generate speech using Microsoft Edge TTS (free, no API key needed)."""
        import edge_tts

        communicate = edge_tts.Communicate(text, voice)
        audio_buffer = io.BytesIO()

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])

        return audio_buffer.getvalue()

    async def _synthesize_coqui(self, text: str, voice: str = "default") -> bytes:
        """Generate speech using self-hosted Coqui TTS server."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.coqui_url}/api/tts",
                params={
                    "text": text,
                    "speaker_id": voice,
                },
            )
            response.raise_for_status()
            return response.content

    def list_providers(self) -> list[dict]:
        """List available TTS providers and their status."""
        providers = []

        if self.openai_api_key:
            providers.append({
                "name": "openai",
                "status": "configured",
                "voices": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
            })

        if self.elevenlabs_api_key:
            providers.append({
                "name": "elevenlabs",
                "status": "configured",
                "voices": ["configurable via voice_id"],
            })

        providers.append({
            "name": "edge-tts",
            "status": "available",
            "voices": ["en-US-AriaNeural", "en-US-GuyNeural", "en-GB-SoniaNeural"],
        })

        providers.append({
            "name": "coqui",
            "status": "available" if self.coqui_url else "not configured",
            "voices": ["default"],
        })

        return providers
