"""Injectable transport boundary for the official TikTok Symphony API.

No endpoint paths, credentials, or browser automation are embedded here.
The concrete transport must be supplied by the deployment after authorized
Symphony API access has been granted and the official developer contract has
been reviewed.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .symphony_adapter import SymphonyRequest


@dataclass(frozen=True)
class SymphonySubmission:
    provider_job_id: str
    status_url: str | None = None


class SymphonyTransport(Protocol):
    def submit(self, request: SymphonyRequest) -> SymphonySubmission: ...

    def get_status(self, provider_job_id: str) -> str: ...


class DisabledSymphonyTransport:
    """Default transport: guarantees no external request can be made."""

    def submit(self, request: SymphonyRequest) -> SymphonySubmission:
        raise RuntimeError(
            "Symphony transport disabled; configure an authorized API transport"
        )

    def get_status(self, provider_job_id: str) -> str:
        raise RuntimeError(
            "Symphony transport disabled; configure an authorized API transport"
        )


def default_symphony_transport() -> SymphonyTransport:
    return DisabledSymphonyTransport()
