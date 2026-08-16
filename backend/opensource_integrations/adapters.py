"""Safe adapter stubs for open-source capability providers.

These adapters give Hermes a stable contract today while keeping direct third-
party execution behind explicit deployment URLs and API keys. They are designed
for progressive hardening: start with metadata + dry-run responses, then replace
individual handlers with authenticated HTTP clients after each service is vetted.
"""

from __future__ import annotations

import os
from typing import Dict

from .models import CapabilityRequest, CapabilityResponse, IntegrationStatus
from .registry import get_provider


CAPABILITY_TO_PROVIDER: Dict[str, str] = {
    "model_chat": "librechat",
    "mcp_tools": "librechat",
    "multi_model_routing": "librechat",
    "workspace_chat": "librechat",
    "image_generation": "open_generative_ai",
    "video_generation": "open_generative_ai",
    "audio_generation": "open_generative_ai",
    "document_generation": "open_generative_ai",
    "code_generation": "open_generative_ai",
    "email_triage": "agentic_inbox",
    "lead_classification": "agentic_inbox",
    "draft_reply": "agentic_inbox",
    "schedule_followup": "agentic_inbox",
    "crm_sync": "agentic_inbox",
    "html_to_video": "hyperframes",
    "mp4_render": "hyperframes",
    "caption_render": "hyperframes",
    "brand_video_template": "hyperframes",
    "ad_audit": "claude_ads",
    "ads_health_score": "claude_ads",
    "campaign_recommendations": "claude_ads",
    "voice_assistant": "open_llm_vtuber",
    "screen_context": "open_llm_vtuber",
    "local_avatar": "open_llm_vtuber",
    "speech_loop": "open_llm_vtuber",
    "financial_analytics": "fincept",
    "portfolio_research": "fincept",
    "market_data_connectors": "fincept",
    "investment_agents": "fincept",
    "quant_research": "autohedge",
    "risk_review": "autohedge",
    "execution_research": "autohedge",
    "trading_research_dag": "vibe_trading",
    "agent_debate": "vibe_trading",
    "market_research": "vibe_trading",
    "authorized_browser_automation": "camofox",
    "accessibility_tree_extraction": "camofox",
}


def env_ready(provider_key: str) -> bool:
    """Check whether all required environment variables exist for a provider."""
    provider = get_provider(provider_key)
    if not provider:
        return False
    return all(bool(os.getenv(name)) for name in provider.env_vars)


def route_capability(request: CapabilityRequest) -> CapabilityResponse:
    """Route a generic Hermes request to the correct provider adapter.

    Current behavior is intentionally safe: it returns a dry-run contract unless
    the provider has been deployed and configured. This prevents accidental live
    trading, scraping, email sending, or media spending.
    """
    provider_key = CAPABILITY_TO_PROVIDER.get(request.capability)
    if not provider_key:
        return CapabilityResponse(
            provider="none",
            capability=request.capability,
            status="unsupported_capability",
            message="No open-source provider is registered for this capability.",
            data={"available_capabilities": sorted(CAPABILITY_TO_PROVIDER.keys())},
        )

    provider = get_provider(provider_key)
    if not provider:
        return CapabilityResponse(
            provider=provider_key,
            capability=request.capability,
            status="provider_missing",
            message="Provider was mapped but not found in registry.",
        )

    if provider.status == IntegrationStatus.disabled:
        return CapabilityResponse(
            provider=provider.key,
            capability=request.capability,
            status="disabled",
            message=provider.caution or "This provider is disabled pending review.",
            data={"task": request.task},
        )

    if not env_ready(provider.key):
        return CapabilityResponse(
            provider=provider.key,
            capability=request.capability,
            status="dry_run_env_required",
            message="Adapter contract is ready, but the external service is not configured yet.",
            data={
                "task": request.task,
                "required_env_vars": provider.env_vars,
                "d3vonn_use_cases": provider.d3vonn_use_cases,
            },
        )

    return CapabilityResponse(
        provider=provider.key,
        capability=request.capability,
        status="ready_for_live_client",
        message="Environment is configured. Replace this dry-run response with the provider-specific authenticated client.",
        data={
            "task": request.task,
            "provider_url": provider.source_url,
            "adapter_endpoint": provider.adapter_endpoint,
        },
    )
