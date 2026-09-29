"""Synthetic-first FHIR adapter contract for HealthOS."""
from dataclasses import dataclass
from typing import Any, Protocol


class FHIRAdapter(Protocol):
    async def get_resource(self, resource_type: str, resource_id: str) -> dict[str, Any]: ...
    async def search(self, resource_type: str, params: dict[str, str]) -> dict[str, Any]: ...


@dataclass
class SyntheticFHIRAdapter:
    fixtures: dict[str, dict[str, Any]]

    async def get_resource(self, resource_type: str, resource_id: str) -> dict[str, Any]:
        key = f"{resource_type}/{resource_id}"
        if key not in self.fixtures:
            raise KeyError(key)
        return self.fixtures[key]

    async def search(self, resource_type: str, params: dict[str, str]) -> dict[str, Any]:
        entries = [
            {"resource": value}
            for key, value in self.fixtures.items()
            if key.startswith(f"{resource_type}/")
        ]
        return {"resourceType": "Bundle", "type": "searchset", "entry": entries}
