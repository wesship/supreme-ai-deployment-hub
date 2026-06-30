"""
backend/tenancy/models.py — Multi-tenant data models for D3VONN.

Each tenant represents an isolated workspace with its own agents, tasks,
and feature flags. The default tenant is the "enterprise" plan used for
single-tenant deployments.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Tenant:
    """Represents a tenant workspace."""

    id: str
    slug: str
    name: str
    plan: str = "free"
    is_active: bool = True
    metadata: dict = field(default_factory=dict)

    @classmethod
    def default(cls) -> "Tenant":
        """Return the default enterprise tenant for single-tenant deployments."""
        return cls(
            id="default",
            slug="default",
            name="D3VONN Default",
            plan="enterprise",
            is_active=True,
        )


# In-memory tenant registry (replace with DB lookup in production)
_TENANT_REGISTRY: dict[str, Tenant] = {
    "default": Tenant.default(),
}


async def get_tenant_by_slug(slug: str) -> Optional[Tenant]:
    """
    Look up a tenant by its URL slug.

    Args:
        slug: The tenant's unique URL slug.

    Returns:
        The matching Tenant, or None if not found.
    """
    return _TENANT_REGISTRY.get(slug)


async def get_tenant_by_id(tenant_id: str) -> Optional[Tenant]:
    """
    Look up a tenant by its ID.

    Args:
        tenant_id: The tenant's unique identifier.

    Returns:
        The matching Tenant, or None if not found.
    """
    for tenant in _TENANT_REGISTRY.values():
        if tenant.id == tenant_id:
            return tenant
    return None
