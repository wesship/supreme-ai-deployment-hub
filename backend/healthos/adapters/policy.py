"""Policy adapter boundary for HealthOS authorization decisions."""
from dataclasses import dataclass
from typing import Any, Protocol


class PolicyAdapter(Protocol):
    async def authorize(self, input_document: dict[str, Any]) -> dict[str, Any]: ...


@dataclass
class SyntheticPolicyAdapter:
    allow_read_only: bool = True

    async def authorize(self, input_document: dict[str, Any]) -> dict[str, Any]:
        action = str(input_document.get("requested_action", ""))
        synthetic = input_document.get("synthetic") is True
        allowed = self.allow_read_only and (
            action.endswith(".lookup") or (synthetic and action == "adt.ingest")
        )
        return {
            "allow": allowed,
            "source": "synthetic-policy",
            "reason": "synthetic sandbox policy" if allowed else "synthetic policy denied",
        }
