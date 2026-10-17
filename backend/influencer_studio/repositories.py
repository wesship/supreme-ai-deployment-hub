from __future__ import annotations

from copy import deepcopy
from typing import Any, Protocol

from backend.hermes.ports import TaskRepository

from .models import Campaign, CampaignState, Persona


class PersonaRepository(Protocol):
    async def save(self, persona: Persona) -> Persona: ...
    async def get(self, persona_id: str) -> Persona | None: ...


class CampaignRepository(Protocol):
    async def save(self, campaign: Campaign) -> Campaign: ...
    async def get(self, campaign_id: str) -> Campaign | None: ...


class InMemoryPersonaRepository:
    """Reference repository used by tests and local development."""

    def __init__(self) -> None:
        self._items: dict[str, Persona] = {}

    async def save(self, persona: Persona) -> Persona:
        self._items[persona.persona_id] = deepcopy(persona)
        return deepcopy(persona)

    async def get(self, persona_id: str) -> Persona | None:
        item = self._items.get(persona_id)
        return deepcopy(item) if item is not None else None


class InMemoryCampaignRepository:
    """Reference repository used by tests and local development."""

    def __init__(self) -> None:
        self._items: dict[str, Campaign] = {}

    async def save(self, campaign: Campaign) -> Campaign:
        self._items[campaign.campaign_id] = deepcopy(campaign)
        return deepcopy(campaign)

    async def get(self, campaign_id: str) -> Campaign | None:
        item = self._items.get(campaign_id)
        return deepcopy(item) if item is not None else None


def _persona_payload(persona: Persona, owner_id: str) -> dict[str, Any]:
    return {
        "id": persona.persona_id,
        "owner_id": owner_id,
        "display_name": persona.display_name,
        "character_bible": persona.character_bible,
        "niche": persona.niche,
        "synthetic_disclosure": persona.synthetic_disclosure,
        "declared_age": persona.declared_age,
        "appearance_spec": persona.appearance_spec,
        "voice_spec": persona.voice_spec,
        "reference_assets": persona.reference_assets,
        "allowed_content": persona.allowed_content,
        "forbidden_content": persona.forbidden_content,
        "provenance": persona.provenance,
    }


def _persona_from_row(row: dict[str, Any]) -> Persona:
    return Persona(
        persona_id=str(row["id"]),
        display_name=str(row["display_name"]),
        character_bible=str(row["character_bible"]),
        niche=str(row["niche"]),
        synthetic_disclosure=bool(row.get("synthetic_disclosure", True)),
        declared_age=int(row.get("declared_age", 21)),
        appearance_spec=dict(row.get("appearance_spec") or {}),
        voice_spec=dict(row.get("voice_spec") or {}),
        reference_assets=list(row.get("reference_assets") or []),
        allowed_content=list(row.get("allowed_content") or []),
        forbidden_content=list(row.get("forbidden_content") or []),
        provenance=dict(row.get("provenance") or {}),
    )


def _campaign_payload(campaign: Campaign, owner_id: str) -> dict[str, Any]:
    return {
        "id": campaign.campaign_id,
        "owner_id": owner_id,
        "persona_id": campaign.persona_id,
        "objective": campaign.objective,
        "state": campaign.state.value,
        "metadata": campaign.metadata,
        "hermes_goal_id": campaign.hermes_goal_id,
        "hermes_task_id": campaign.hermes_task_id,
    }


def _campaign_from_row(row: dict[str, Any]) -> Campaign:
    return Campaign(
        campaign_id=str(row["id"]),
        persona_id=str(row["persona_id"]),
        objective=str(row["objective"]),
        state=CampaignState(str(row["state"])),
        metadata=dict(row.get("metadata") or {}),
        hermes_goal_id=str(row["hermes_goal_id"]) if row.get("hermes_goal_id") else None,
        hermes_task_id=str(row["hermes_task_id"]) if row.get("hermes_task_id") else None,
    )


class SupabasePersonaRepository:
    """Owner-scoped Persona persistence using the canonical Hermes repository port."""

    table = "influencer_personas"

    def __init__(self, repository: TaskRepository, owner_id: str) -> None:
        if not owner_id.strip():
            raise ValueError("owner_id is required")
        self._repository = repository
        self._owner_id = owner_id

    async def save(self, persona: Persona) -> Persona:
        payload = _persona_payload(persona, self._owner_id)
        rows = await self._repository.list_rows(
            self.table,
            {
                "id": f"eq.{persona.persona_id}",
                "owner_id": f"eq.{self._owner_id}",
                "limit": "1",
            },
        )
        if rows:
            row = await self._repository.update_row(self.table, persona.persona_id, payload)
        else:
            row = await self._repository.create_row(self.table, payload)
        return _persona_from_row(row)

    async def get(self, persona_id: str) -> Persona | None:
        rows = await self._repository.list_rows(
            self.table,
            {
                "id": f"eq.{persona_id}",
                "owner_id": f"eq.{self._owner_id}",
                "limit": "1",
            },
        )
        return _persona_from_row(rows[0]) if rows else None


class SupabaseCampaignRepository:
    """Owner-scoped Campaign persistence using the canonical Hermes repository port."""

    table = "influencer_campaigns"

    def __init__(self, repository: TaskRepository, owner_id: str) -> None:
        if not owner_id.strip():
            raise ValueError("owner_id is required")
        self._repository = repository
        self._owner_id = owner_id

    async def save(self, campaign: Campaign) -> Campaign:
        payload = _campaign_payload(campaign, self._owner_id)
        rows = await self._repository.list_rows(
            self.table,
            {
                "id": f"eq.{campaign.campaign_id}",
                "owner_id": f"eq.{self._owner_id}",
                "limit": "1",
            },
        )
        if rows:
            row = await self._repository.update_row(self.table, campaign.campaign_id, payload)
        else:
            row = await self._repository.create_row(self.table, payload)
        return _campaign_from_row(row)

    async def get(self, campaign_id: str) -> Campaign | None:
        rows = await self._repository.list_rows(
            self.table,
            {
                "id": f"eq.{campaign_id}",
                "owner_id": f"eq.{self._owner_id}",
                "limit": "1",
            },
        )
        return _campaign_from_row(rows[0]) if rows else None
