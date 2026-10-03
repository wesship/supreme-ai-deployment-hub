from __future__ import annotations

from copy import deepcopy
from typing import Protocol

from .models import Campaign, Persona


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
