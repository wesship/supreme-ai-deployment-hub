from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class MediaCapability(str, Enum):
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_TO_IMAGE = "image_to_image"
    TEXT_TO_VIDEO = "text_to_video"
    IMAGE_TO_VIDEO = "image_to_video"
    MOTION_TRANSFER = "motion_transfer"
    UPSCALE = "upscale"
    IDENTITY_PRESERVATION = "identity_preservation"


@dataclass(frozen=True, slots=True)
class MediaRequest:
    capability: MediaCapability
    prompt: str
    persona_id: str
    reference_assets: tuple[str, ...] = ()
    options: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class MediaJob:
    provider: str
    external_job_id: str
    status: str
    provenance: dict[str, Any] = field(default_factory=dict)


class MediaProvider(ABC):
    name: str
    capabilities: frozenset[MediaCapability]

    def supports(self, capability: MediaCapability) -> bool:
        return capability in self.capabilities

    @abstractmethod
    async def submit(self, request: MediaRequest) -> MediaJob:
        raise NotImplementedError

    @abstractmethod
    async def get_job(self, external_job_id: str) -> MediaJob:
        raise NotImplementedError


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, MediaProvider] = {}

    def register(self, provider: MediaProvider) -> None:
        if provider.name in self._providers:
            raise ValueError(f"Provider already registered: {provider.name}")
        self._providers[provider.name] = provider

    def get(self, name: str) -> MediaProvider:
        try:
            return self._providers[name]
        except KeyError as exc:
            raise KeyError(f"Unknown media provider: {name}") from exc

    def capable(self, capability: MediaCapability) -> list[MediaProvider]:
        return [provider for provider in self._providers.values() if provider.supports(capability)]

    def capabilities(self) -> dict[str, list[str]]:
        return {
            name: sorted(capability.value for capability in provider.capabilities)
            for name, provider in self._providers.items()
        }
