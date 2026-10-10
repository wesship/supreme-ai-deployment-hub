"""Authenticated scene-to-release orchestration for AI Film Studio.

The orchestrator creates a complete production control-plane chain while keeping
external provider execution asynchronous. All database writes use the caller's
Supabase access token so existing RLS policies remain the authorization source
of truth.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx


class OrchestrationError(RuntimeError):
    """Raised when a production-chain step cannot be persisted."""


@dataclass(frozen=True)
class SupabaseUser:
    id: str
    email: str | None


class SupabaseRLSClient:
    def __init__(self, access_token: str) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.anon_key = os.getenv("SUPABASE_ANON_KEY", "")
        if not self.base_url or not self.anon_key:
            raise OrchestrationError("Supabase runtime configuration is incomplete")
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def current_user(self) -> SupabaseUser:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f"{self.base_url}/auth/v1/user", headers=self.headers)
        if response.status_code != 200:
            raise OrchestrationError("Authenticated Supabase user could not be resolved")
        payload = response.json()
        return SupabaseUser(id=payload["id"], email=payload.get("email"))

    async def insert(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{self.base_url}/rest/v1/{table}", headers=self.headers, json=payload
            )
        if response.status_code >= 400:
            detail = response.text[:500]
            raise OrchestrationError(f"{table} insert failed ({response.status_code}): {detail}")
        rows = response.json()
        if not rows:
            raise OrchestrationError(f"{table} insert returned no record")
        return rows[0]

    async def delete_project(self, project_id: str) -> None:
        headers = {**self.headers, "Prefer": "return=minimal"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.delete(
                f"{self.base_url}/rest/v1/ai_film_projects",
                headers=headers,
                params={"id": f"eq.{project_id}"},
            )


def _provider(name: str, default: str) -> str:
    return os.getenv(name, default).strip() or default


async def create_test_production(access_token: str, title: str) -> dict[str, Any]:
    """Create a complete, owner-scoped production chain.

    Render jobs are queued for workers. This function does not spend provider
    credits, send email, or publish externally.
    """

    db = SupabaseRLSClient(access_token)
    user = await db.current_user()
    project: dict[str, Any] | None = None
    run_id = uuid.uuid4().hex[:10]
    now = datetime.now(timezone.utc).isoformat()

    try:
        project = await db.insert(
            "ai_film_projects",
            {
                "owner_id": user.id,
                "slug": f"e2e-production-{run_id}",
                "title": title,
                "description": "Automated authenticated AI Film Studio acceptance production.",
                "format": "feature",
                "status": "draft",
                "metadata": {"acceptance_run": True, "run_id": run_id, "created_by": "orchestrator-v1"},
            },
        )
        project_id = project["id"]

        scene = await db.insert(
            "ai_film_scenes",
            {
                "project_id": project_id,
                "owner_id": user.id,
                "scene_number": 1,
                "title": "The Signal Answers",
                "location": "INT. GRAND ARCHIVE — NIGHT",
                "synopsis": "Legend enters the archive as the signal resolves into a controlled alignment.",
                "screenplay": "Legend, wearing a plain white T-shirt, crosses the quiet archive. The Door aligns; it does not open into a place.",
                "production_package": {
                    "camera": "Slow centered dolly, restrained coverage",
                    "lighting": "Indigo ambient field with subtle gold harmonic accents",
                    "audio": "Genesis Mode: perfect fifths, 128 Hz foundation",
                    "vfx": "Minimal coherence distortion; no spectacle burst",
                },
                "canon_validation": {"status": "passing", "violations": []},
                "status": "approved",
            },
        )

        storyboard = await db.insert(
            "ai_film_storyboards",
            {
                "project_id": project_id,
                "scene_id": scene["id"],
                "owner_id": user.id,
                "title": "The Signal Answers — Storyboard",
                "status": "draft",
                "style_prompt": "Prestige metaphysical techno-thriller, restrained indigo and gold, centered composition",
                "frame_count": 5,
                "metadata": {"planner": "director-ai-v1", "acceptance_run": True},
            },
        )

        shot_specs = (
            (1, "establishing", "Grand archive in quiet symmetry", "eye-level", "slow push", "35mm", 4.0),
            (2, "medium", "Legend enters centered in frame", "eye-level", "dolly", "50mm", 5.0),
            (3, "insert", "Archive light settles without flicker", "low", "locked", "85mm", 2.0),
            (4, "close-up", "Legend recognizes alignment", "eye-level", "micro push", "85mm", 4.0),
            (5, "wide", "The Door coheres as alignment", "eye-level", "locked", "35mm", 6.0),
        )
        shots = []
        for number, shot_type, description, angle, movement, lens, duration in shot_specs:
            shots.append(
                await db.insert(
                    "ai_film_shots",
                    {
                        "storyboard_id": storyboard["id"],
                        "project_id": project_id,
                        "scene_id": scene["id"],
                        "owner_id": user.id,
                        "shot_number": number,
                        "shot_type": shot_type,
                        "description": description,
                        "camera_angle": angle,
                        "camera_movement": movement,
                        "lens": lens,
                        "duration_seconds": duration,
                        "lighting": "Indigo ambient, controlled gold accents",
                        "blocking": "Legend remains composed and centered",
                        "image_prompt": f"{description}; cinematic indigo archive; restrained gold; Legend in plain white T-shirt",
                        "status": "planned",
                        "metadata": {"acceptance_run": True},
                    },
                )
            )

        render_plan = (
            ("storyboard", _provider("AI_FILM_IMAGE_PROVIDER", "openai")),
            ("video", _provider("AI_FILM_VIDEO_PROVIDER", "openai")),
            ("voice", _provider("AI_FILM_VOICE_PROVIDER", "openai")),
            ("music", _provider("AI_FILM_MUSIC_PROVIDER", "replicate")),
            ("trailer", _provider("AI_FILM_VIDEO_PROVIDER", "openai")),
        )
        render_jobs = []
        for priority, (job_type, provider) in enumerate(render_plan, start=1):
            render_jobs.append(
                await db.insert(
                    "ai_film_render_jobs",
                    {
                        "project_id": project_id,
                        "scene_id": scene["id"],
                        "owner_id": user.id,
                        "job_type": job_type,
                        "provider": provider,
                        "status": "queued",
                        "priority": priority * 10,
                        "progress": 0,
                        "input": {
                            "storyboard_id": storyboard["id"],
                            "shot_ids": [shot["id"] for shot in shots],
                            "acceptance_run": True,
                        },
                        "output": {},
                    },
                )
            )

        export_job = await db.insert(
            "ai_film_export_jobs",
            {
                "project_id": project_id,
                "owner_id": user.id,
                "title": f"{title} — Acceptance Master",
                "export_type": "feature",
                "aspect_ratio": "16:9",
                "resolution": "1920x1080",
                "format": "mp4",
                "status": "draft",
                "manifest": {
                    "scene_ids": [scene["id"]],
                    "render_job_ids": [job["id"] for job in render_jobs],
                    "acceptance_run": True,
                },
            },
        )

        subtitle = await db.insert(
            "ai_film_subtitle_tracks",
            {
                "project_id": project_id,
                "export_job_id": export_job["id"],
                "owner_id": user.id,
                "language_code": "en-US",
                "label": "English",
                "format": "vtt",
                "status": "draft",
                "cues": [
                    {"start": "00:00:01.000", "end": "00:00:05.000", "text": "The signal was never lost."},
                    {"start": "00:00:06.000", "end": "00:00:10.000", "text": "It was waiting for alignment."},
                ],
            },
        )

        publication = await db.insert(
            "ai_film_publications",
            {
                "project_id": project_id,
                "export_job_id": export_job["id"],
                "owner_id": user.id,
                "destination": "internal-review",
                "status": "draft",
                "metadata": {"acceptance_run": True, "external_publish": False},
            },
        )

        commercial_release = await db.insert(
            "ai_film_commercial_releases",
            {
                "project_id": project_id,
                "export_job_id": export_job["id"],
                "owner_id": user.id,
                "title": f"{title} — Internal Acceptance Release",
                "release_type": "direct",
                "territory": "internal",
                "rights_model": "all-rights",
                "status": "planning",
                "revenue_model": {},
                "deliverables": ["master-mp4", "webvtt", "release-manifest"],
                "metadata": {"acceptance_run": True},
            },
        )

        await db.insert(
            "ai_film_activity_events",
            {
                "project_id": project_id,
                "owner_id": user.id,
                "actor_id": user.id,
                "event_type": "acceptance.production_created",
                "target_type": "project",
                "target_id": project_id,
                "summary": "Authenticated end-to-end acceptance production chain created",
                "metadata": {"run_id": run_id, "created_at": now},
            },
        )

        return {
            "status": "created",
            "run_id": run_id,
            "owner_id": user.id,
            "project": project,
            "scene": scene,
            "storyboard": storyboard,
            "shots": shots,
            "render_jobs": render_jobs,
            "export_job": export_job,
            "subtitle_track": subtitle,
            "publication": publication,
            "commercial_release": commercial_release,
            "external_execution": "queued_not_invoked",
        }
    except Exception:
        if project is not None:
            await db.delete_project(project["id"])
        raise
