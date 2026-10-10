"""Scheduled monitoring helpers for Hermes Research OS.

This module is intentionally framework-neutral. The functions can be called from
APScheduler, Celery, GitHub Actions, Railway cron, Supabase cron, or Hermes DAGs.
"""

from __future__ import annotations

from .models import ResearchQueryRequest
from .router import research_query


async def run_monitoring_query(query: str, *, tenant_id: str | None = None, enrich_leads: bool = False):
    """Execute one scheduled Research OS query."""
    request = ResearchQueryRequest(
        query=query,
        tenant_id=tenant_id,
        enrich_leads=enrich_leads,
        save_to_dkos=True,
        metadata={"trigger": "scheduled_monitoring"},
    )
    return await research_query(request)


DEFAULT_MONITORS = [
    "AI automation insurance agency pain points",
    "multi-agent AI orchestration competitors pricing funding",
    "D3VONN AI business operating system market signals",
]
