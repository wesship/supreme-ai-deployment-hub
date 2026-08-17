"""
PersonaLive Service Client
============================
Communicates with the PersonaLive GPU service (Docker container on port 7870)
to generate animated avatar video from reference images and driving audio.
"""

import io
import logging
import tempfile
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class PersonaLiveClient:
    """Client for the PersonaLive REST API (neosun100 production fork)."""

    def __init__(self, base_url: str = "http://localhost:7870", timeout: float = 60.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def check_health(self) -> bool:
        """Check if the PersonaLive service is running and healthy."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception as e:
            logger.warning("PersonaLive health check failed: %s", str(e))
            return False

    async def get_gpu_status(self) -> Optional[dict]:
        """Get GPU utilization and memory status from PersonaLive."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/api/gpu/status")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error("Failed to get GPU status: %s", str(e))
            return None

    async def animate(
        self,
        reference_image: str,
        audio_data: bytes,
        session_id: str,
        max_frames: int = 300,
    ) -> dict:
        """
        Generate animated avatar video from a reference image and driving audio.

        The PersonaLive service accepts a reference portrait image and a driving
        signal (audio or video). For the Devonn.AI integration, we convert TTS
        audio into a driving video with lip-sync motion, then pass it to PersonaLive.

        Args:
            reference_image: Path to the reference portrait image file
            audio_data: Raw audio bytes (WAV/MP3 format) from the voice engine
            session_id: Session identifier for caching and output naming
            max_frames: Maximum number of frames to generate

        Returns:
            Dictionary with video_url and audio_url for the generated content
        """
        try:
            # Save audio to a temporary file for upload
            audio_path = Path(tempfile.mktemp(suffix=".wav"))
            audio_path.write_bytes(audio_data)

            # Prepare the multipart form data
            files = {
                "reference_image": (
                    "reference.png",
                    open(reference_image, "rb"),
                    "image/png",
                ),
                "driving_video": (
                    "driving_audio.wav",
                    open(str(audio_path), "rb"),
                    "audio/wav",
                ),
            }

            data = {
                "max_frames": str(max_frames),
                "session_id": session_id,
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/process/offline",
                    files=files,
                    data=data,
                )
                response.raise_for_status()
                result = response.json()

            # Clean up temp file
            audio_path.unlink(missing_ok=True)

            return {
                "video_url": result.get("video_url", f"/output/{session_id}.mp4"),
                "audio_url": result.get("audio_url"),
                "frames_generated": result.get("frames", max_frames),
                "status": "completed",
            }

        except httpx.TimeoutException:
            logger.error("PersonaLive animation timed out for session %s", session_id)
            return {"status": "timeout", "error": "Animation generation timed out"}
        except httpx.HTTPStatusError as e:
            logger.error("PersonaLive HTTP error: %s", str(e))
            return {"status": "error", "error": str(e)}
        except Exception as e:
            logger.error("PersonaLive animation failed: %s", str(e))
            return {"status": "error", "error": str(e)}

    async def fuse_reference(self, reference_image: str) -> dict:
        """
        Pre-process a reference image for faster subsequent animations.
        This caches the identity encoding so future animate() calls are faster.

        Args:
            reference_image: Path to the reference portrait image

        Returns:
            Dictionary with status and cached reference ID
        """
        try:
            files = {
                "reference_image": (
                    "reference.png",
                    open(reference_image, "rb"),
                    "image/png",
                ),
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/fuse-reference",
                    files=files,
                )
                response.raise_for_status()
                return response.json()

        except Exception as e:
            logger.error("Reference fusion failed: %s", str(e))
            return {"status": "error", "error": str(e)}
