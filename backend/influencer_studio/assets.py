from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import uuid4

from backend.hermes.ports import TaskRepository

from .providers import MediaJob, MediaRequest


@dataclass(slots=True)
class CampaignAsset:
    campaign_id: str
    persona_id: str
    provider: str
    capability: str
    provider_job_id: str
    status: str
    asset_id: str = field(default_factory=lambda: str(uuid4()))
    ai_film_asset_id: str | None = None
    storage_path: str | None = None
    provenance: dict[str, Any] = field(default_factory=dict)
    rights_verified: bool = False
    qa_passed: bool = False
    approved_by: str | None = None


class CampaignAssetRepository(Protocol):
    async def save(self, asset: CampaignAsset) -> CampaignAsset: ...
    async def list_for_campaign(self, campaign_id: str) -> list[CampaignAsset]: ...


class InMemoryCampaignAssetRepository:
    def __init__(self) -> None:
        self._items: dict[str, CampaignAsset] = {}

    async def save(self, asset: CampaignAsset) -> CampaignAsset:
        self._items[asset.asset_id] = asset
        return asset

    async def list_for_campaign(self, campaign_id: str) -> list[CampaignAsset]:
        return [asset for asset in self._items.values() if asset.campaign_id == campaign_id]


def normalize_status(status: str) -> str:
    normalized = status.strip().lower()
    aliases = {
        "submitted": "queued",
        "pending": "queued",
        "processing": "running",
        "complete": "succeeded",
        "completed": "succeeded",
        "success": "succeeded",
        "error": "failed",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in {"queued", "running", "succeeded", "failed", "cancelled", "unknown"} else "unknown"


def asset_from_job(
    *,
    campaign_id: str,
    request: MediaRequest,
    job: MediaJob,
) -> CampaignAsset:
    return CampaignAsset(
        campaign_id=campaign_id,
        persona_id=request.persona_id,
        provider=job.provider,
        capability=request.capability.value,
        provider_job_id=job.external_job_id,
        status=normalize_status(job.status),
        provenance={
            "request": {
                "capability": request.capability.value,
                "prompt": request.prompt,
                "reference_assets": list(request.reference_assets),
                "options": dict(request.options),
            },
            "provider": dict(job.provenance),
        },
    )


class SupabaseCampaignAssetRepository:
    table = "influencer_campaign_assets"

    def __init__(self, repository: TaskRepository, owner_id: str) -> None:
        if not owner_id.strip():
            raise ValueError("owner_id is required")
        self._repository = repository
        self._owner_id = owner_id

    @staticmethod
    def _from_row(row: dict[str, Any]) -> CampaignAsset:
        return CampaignAsset(
            asset_id=str(row["id"]),
            campaign_id=str(row["campaign_id"]),
            persona_id=str(row["persona_id"]),
            provider=str(row["provider"]),
            capability=str(row["capability"]),
            provider_job_id=str(row["provider_job_id"]),
            status=str(row["status"]),
            ai_film_asset_id=str(row["ai_film_asset_id"]) if row.get("ai_film_asset_id") else None,
            storage_path=str(row["storage_path"]) if row.get("storage_path") else None,
            provenance=dict(row.get("provenance") or {}),
            rights_verified=bool(row.get("rights_verified", False)),
            qa_passed=bool(row.get("qa_passed", False)),
            approved_by=str(row["approved_by"]) if row.get("approved_by") else None,
        )

    def _payload(self, asset: CampaignAsset) -> dict[str, Any]:
        return {
            "id": asset.asset_id,
            "owner_id": self._owner_id,
            "campaign_id": asset.campaign_id,
            "persona_id": asset.persona_id,
            "provider": asset.provider,
            "capability": asset.capability,
            "provider_job_id": asset.provider_job_id,
            "status": asset.status,
            "ai_film_asset_id": asset.ai_film_asset_id,
            "storage_path": asset.storage_path,
            "provenance": asset.provenance,
            "rights_verified": asset.rights_verified,
            "qa_passed": asset.qa_passed,
            "approved_by": asset.approved_by,
        }

    async def save(self, asset: CampaignAsset) -> CampaignAsset:
        payload = self._payload(asset)
        rows = await self._repository.list_rows(
            self.table,
            {
                "id": f"eq.{asset.asset_id}",
                "owner_id": f"eq.{self._owner_id}",
                "limit": "1",
            },
        )
        if rows:
            row = await self._repository.update_row(self.table, asset.asset_id, payload)
        else:
            row = await self._repository.create_row(self.table, payload)
        return self._from_row(row)

    async def list_for_campaign(self, campaign_id: str) -> list[CampaignAsset]:
        rows = await self._repository.list_rows(
            self.table,
            {
                "campaign_id": f"eq.{campaign_id}",
                "owner_id": f"eq.{self._owner_id}",
                "order": "created_at.desc",
            },
        )
        return [self._from_row(row) for row in rows]
