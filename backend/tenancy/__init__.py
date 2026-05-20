"""backend/tenancy — Multi-tenant data isolation and tenant resolution."""
from .models import Tenant, get_tenant_by_slug

__all__ = ["Tenant", "get_tenant_by_slug"]
