from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from backend.client_ai.auth import ClientAIUser
from backend.hermes.dependencies import get_dependencies
from backend.hermes.task_engine import create_task

router = APIRouter(prefix="/api/client-ai", tags=["client-ai-ingestion"])

DKOS_STAGES = [
    "security_scan",
    "file_classification",
    "ocr",
    "docling",
    "markitdown",
    "markdown_cleanup",
    "metadata_extraction",
    "knowledge_graph",
    "semantic_chunking",
    "embeddings",
    "pinecone_storage",
    "hermes_memory",
]


class IngestionDispatchOut(BaseModel):
    accepted: bool
    source_id: str
    run_id: str
    task_id: str | None = None
    current_stage: str
    stages: list[dict[str, str]]


class IngestionStatusOut(BaseModel):
    source_id: str
    run_id: str | None = None
    ingestion_status: str
    current_stage: str | None = None
    stages: list[dict[str, str]]
    error_message: str | None = None


async def _owned_profile(repository: Any, profile_id: str, user_id: str) -> dict[str, Any]:
    rows = await repository.list_rows(
        "client_ai_profiles",
        {"id": f"eq.{profile_id}", "user_id": f"eq.{user_id}", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Client AI profile not found")
    return rows[0]


async def _owned_source(repository: Any, profile_id: str, source_id: str, user_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    profile = await _owned_profile(repository, profile_id, user_id)
    rows = await repository.list_rows(
        "client_ai_sources",
        {"id": f"eq.{source_id}", "profile_id": f"eq.{profile_id}", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Client AI source not found")
    return profile, rows[0]


def _stage_rows(current_stage: str | None, completed: bool = False) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    reached_current = False
    for stage in DKOS_STAGES:
        if completed:
            state = "completed"
        elif current_stage is None:
            state = "pending"
        elif stage == current_stage:
            state = "running"
            reached_current = True
        elif not reached_current:
            state = "completed"
        else:
            state = "pending"
        rows.append({"stage": stage, "status": state})
    return rows


@router.post(
    "/profiles/{profile_id}/sources/{source_id}/ingestion",
    response_model=IngestionDispatchOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def dispatch_source_ingestion(
    profile_id: str,
    source_id: str,
    principal: ClientAIUser,
) -> IngestionDispatchOut:
    deps = get_dependencies()
    repository = deps.repository
    if not repository.configured:
        raise HTTPException(status_code=503, detail="Client AI ingestion is not configured")

    profile, source = await _owned_source(repository, profile_id, source_id, principal.user_id)
    if source.get("ingestion_status") == "revoked":
        raise HTTPException(status_code=409, detail="Source consent has been revoked")

    metadata = source.get("metadata") if isinstance(source.get("metadata"), dict) else {}
    consent = metadata.get("consent") if isinstance(metadata.get("consent"), dict) else {}
    if consent.get("authorized_for_ai_training") is not True:
        raise HTTPException(status_code=409, detail="Explicit AI-training consent is required")

    existing_run = source.get("ingestion_run_id")
    if existing_run and source.get("ingestion_status") in {"pending", "processing", "ready"}:
        return IngestionDispatchOut(
            accepted=True,
            source_id=source_id,
            run_id=str(existing_run),
            task_id=source.get("hermes_task_id"),
            current_stage=source.get("current_stage") or "security_scan",
            stages=_stage_rows(source.get("current_stage") or "security_scan", source.get("ingestion_status") == "ready"),
        )

    run_id = str(uuid.uuid4())
    correlation_id = f"client-ai-dkos:{profile_id}:{source_id}:{run_id}"
    manifest = {
        "run_id": run_id,
        "profile_id": profile_id,
        "source_id": source_id,
        "tenant_id": f"client-ai:{profile.get('client_key')}:{profile_id}",
        "uploaded_by": principal.user_id,
        "classification": metadata.get("classification", "internal"),
        "source_type": source.get("source_type"),
        "source_uri": source.get("source_uri"),
        "title": source.get("title"),
        "pipeline": DKOS_STAGES,
        "contract": "dkos-ingestion-v1",
    }

    task = await create_task(
        title=f"Ingest Client AI source {source_id} into DKOS",
        task_type="client_ai_dkos_ingestion",
        description="Run the consented Client AI source through the governed DKOS ingestion pipeline and update stage status after each durable checkpoint.",
        agent_name="hermes",
        input_data=manifest,
        priority=4,
        source="client-ai-ingestion-bridge",
        correlation_id=correlation_id,
    )

    await repository.update_row(
        "client_ai_sources",
        source_id,
        {
            "ingestion_status": "processing",
            "ingestion_run_id": run_id,
            "hermes_task_id": task.get("id"),
            "current_stage": "security_scan",
            "error_message": None,
        },
    )
    await repository.update_row(
        "client_ai_profiles",
        profile_id,
        {"profile_state": "training"},
    )

    return IngestionDispatchOut(
        accepted=True,
        source_id=source_id,
        run_id=run_id,
        task_id=task.get("id"),
        current_stage="security_scan",
        stages=_stage_rows("security_scan"),
    )


@router.get(
    "/profiles/{profile_id}/sources/{source_id}/ingestion",
    response_model=IngestionStatusOut,
)
async def get_source_ingestion_status(
    profile_id: str,
    source_id: str,
    principal: ClientAIUser,
) -> IngestionStatusOut:
    repository = get_dependencies().repository
    _, source = await _owned_source(repository, profile_id, source_id, principal.user_id)
    ready = source.get("ingestion_status") == "ready"
    return IngestionStatusOut(
        source_id=source_id,
        run_id=source.get("ingestion_run_id"),
        ingestion_status=source.get("ingestion_status", "pending"),
        current_stage=source.get("current_stage"),
        stages=_stage_rows(source.get("current_stage"), ready),
        error_message=source.get("error_message"),
    )
