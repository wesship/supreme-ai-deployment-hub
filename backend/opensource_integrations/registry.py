"""Canonical registry for open-source capability providers.

The registry intentionally stores metadata and safe adapter contracts only.
D3VONN.IO should not clone or execute these projects blindly. Each provider must
be deployed, reviewed, and connected through explicit environment variables.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from .models import IntegrationProvider, IntegrationStatus, IntegrationTier


PROVIDERS: Dict[str, IntegrationProvider] = {
    "librechat": IntegrationProvider(
        key="librechat",
        name="LibreChat",
        source_url="https://github.com/danny-avila/LibreChat",
        replaces="ChatGPT Plus style multi-model workspace",
        tier=IntegrationTier.tier_1,
        status=IntegrationStatus.adapter_ready,
        capabilities=["model_chat", "mcp_tools", "multi_model_routing", "workspace_chat"],
        d3vonn_use_cases=[
            "AI Gateway for D3VONN.IO",
            "Hermes-controlled model routing",
            "Internal chat console for operators",
            "Bring-your-own-key enterprise workspace",
        ],
        adapter_endpoint="/api/opensource/providers/librechat/invoke",
        env_vars=["LIBRECHAT_BASE_URL", "LIBRECHAT_API_KEY"],
    ),
    "open_generative_ai": IntegrationProvider(
        key="open_generative_ai",
        name="Open Generative AI",
        source_url="https://github.com/Anil-matcha/Open-Generative-AI",
        replaces="Multi-modal AI control panel for image, video, audio, code, and documents",
        tier=IntegrationTier.tier_1,
        status=IntegrationStatus.external_service_required,
        capabilities=["image_generation", "video_generation", "audio_generation", "document_generation", "code_generation"],
        d3vonn_use_cases=[
            "Unified creative AI workspace",
            "Marketing asset generation",
            "Document and presentation production",
            "Multi-provider media model routing",
        ],
        adapter_endpoint="/api/opensource/providers/open_generative_ai/invoke",
        env_vars=["OPEN_GENERATIVE_AI_BASE_URL", "OPEN_GENERATIVE_AI_API_KEY"],
    ),
    "agentic_inbox": IntegrationProvider(
        key="agentic_inbox",
        name="Agentic Inbox",
        source_url="https://github.com/cloudflare/agentic-inbox",
        replaces="AI inbox / Superhuman-style email automation",
        tier=IntegrationTier.tier_1,
        status=IntegrationStatus.external_service_required,
        capabilities=["email_triage", "lead_classification", "draft_reply", "schedule_followup", "crm_sync"],
        d3vonn_use_cases=[
            "Insurance lead inbox triage",
            "Hermes-generated replies",
            "CRM contact and pipeline updates",
            "Follow-up task creation",
        ],
        adapter_endpoint="/api/opensource/providers/agentic_inbox/invoke",
        env_vars=["AGENTIC_INBOX_BASE_URL", "AGENTIC_INBOX_API_KEY"],
    ),
    "hyperframes": IntegrationProvider(
        key="hyperframes",
        name="Hyperframes",
        source_url="https://github.com/heygen-com/hyperframes",
        replaces="Programmatic video SaaS",
        tier=IntegrationTier.tier_1,
        status=IntegrationStatus.external_service_required,
        capabilities=["html_to_video", "mp4_render", "caption_render", "brand_video_template"],
        d3vonn_use_cases=[
            "Recruiting videos for insurance agents",
            "Tokenized asset explainer videos",
            "SOC/security recap videos",
            "Automated branded social content",
        ],
        adapter_endpoint="/api/opensource/providers/hyperframes/invoke",
        env_vars=["HYPERFRAMES_BASE_URL", "HYPERFRAMES_API_KEY"],
    ),
    "claude_ads": IntegrationProvider(
        key="claude_ads",
        name="Claude Ads",
        source_url="https://github.com/AgriciDaniel/claude-ads",
        replaces="Agency ad audit",
        tier=IntegrationTier.tier_2,
        status=IntegrationStatus.planned,
        capabilities=["ad_audit", "ads_health_score", "campaign_recommendations"],
        d3vonn_use_cases=[
            "Marketing dashboard extension",
            "Insurance recruiting campaign audit",
            "Lead generation quality checks",
        ],
        adapter_endpoint="/api/opensource/providers/claude_ads/invoke",
        env_vars=["CLAUDE_ADS_BASE_URL", "CLAUDE_ADS_API_KEY"],
    ),
    "open_llm_vtuber": IntegrationProvider(
        key="open_llm_vtuber",
        name="Open-LLM-VTuber",
        source_url="https://github.com/Open-LLM-VTuber/Open-LLM-VTuber",
        replaces="AI companion apps",
        tier=IntegrationTier.tier_2,
        status=IntegrationStatus.planned,
        capabilities=["voice_assistant", "screen_context", "local_avatar", "speech_loop"],
        d3vonn_use_cases=[
            "Professional desktop assistant",
            "Voice + screen context prototype",
            "Local-first assistant research",
        ],
        adapter_endpoint="/api/opensource/providers/open_llm_vtuber/invoke",
        env_vars=["OPEN_LLM_VTUBER_BASE_URL"],
    ),
    "defillama_yields": IntegrationProvider(
        key="defillama_yields",
        name="DefiLlama Yield Server",
        source_url="https://github.com/DefiLlama/yield-server",
        replaces="Custom DeFi pool discovery and yield-normalization service",
        tier=IntegrationTier.tier_1,
        status=IntegrationStatus.planned,
        capabilities=["liquidity_pool_discovery", "yield_benchmark_data"],
        d3vonn_use_cases=[
            "Liquidity-pool candidate discovery",
            "TVL/APY benchmark ingestion",
            "Cross-protocol opportunity screening before risk review",
        ],
        adapter_endpoint="/api/opensource/providers/defillama_yields/invoke",
        caution="Discovery data is research input only; never use APY alone as an execution signal.",
    ),
    "uniswap_ai": IntegrationProvider(
        key="uniswap_ai",
        name="Uniswap AI",
        source_url="https://github.com/Uniswap/uniswap-ai",
        replaces="Custom agent planning primitives for Uniswap workflows",
        tier=IntegrationTier.tier_1,
        status=IntegrationStatus.planned,
        capabilities=["liquidity_planning", "swap_planning"],
        d3vonn_use_cases=[
            "Hermes liquidity-plan generation",
            "Concentrated-liquidity planning references",
            "Agent-facing Uniswap workflow patterns",
        ],
        adapter_endpoint="/api/opensource/providers/uniswap_ai/invoke",
        caution="Planning only in V0.1; transaction signing and broadcast are disabled.",
    ),
    "foundry": IntegrationProvider(
        key="foundry",
        name="Foundry / Anvil",
        source_url="https://github.com/foundry-rs/foundry",
        replaces="Custom EVM fork and transaction simulation harness",
        tier=IntegrationTier.tier_1,
        status=IntegrationStatus.planned,
        capabilities=["transaction_simulation", "fork_simulation"],
        d3vonn_use_cases=[
            "Mandatory pre-execution fork simulation",
            "Revert/gas/balance-change verification",
            "Liquidity rebalance safety testing",
        ],
        adapter_endpoint="/api/opensource/providers/foundry/invoke",
        caution="A simulation pass is required before any Safe proposal can advance.",
    ),
    "safe_core": IntegrationProvider(
        key="safe_core",
        name="Safe Core SDK",
        source_url="https://github.com/safe-global/safe-core-sdk",
        replaces="Custom multisig transaction proposal layer",
        tier=IntegrationTier.tier_1,
        status=IntegrationStatus.planned,
        capabilities=["safe_transaction_proposal", "multisig_policy"],
        d3vonn_use_cases=[
            "Non-custodial treasury boundary",
            "Human/multisig approval for liquidity proposals",
            "Auditable transaction proposal workflow",
        ],
        adapter_endpoint="/api/opensource/providers/safe_core/invoke",
        caution="The agent never receives unrestricted signing authority or private-key access.",
    ),
    "hummingbot_gateway": IntegrationProvider(
        key="hummingbot_gateway",
        name="Hummingbot Gateway",
        source_url="https://github.com/hummingbot/gateway",
        replaces="Custom DEX connector and AMM execution middleware",
        tier=IntegrationTier.tier_2,
        status=IntegrationStatus.planned,
        capabilities=["dex_execution_gateway", "amm_connector"],
        d3vonn_use_cases=[
            "Standardized DEX connector layer",
            "Future policy-controlled AMM execution middleware",
            "Paper/simulation strategy integration",
        ],
        adapter_endpoint="/api/opensource/providers/hummingbot_gateway/invoke",
        caution="Live execution remains disabled until a later reviewed gate.",
    ),
    "graph_node": IntegrationProvider(
        key="graph_node",
        name="Graph Node",
        source_url="https://github.com/graphprotocol/graph-node",
        replaces="Custom historical on-chain indexing service",
        tier=IntegrationTier.tier_2,
        status=IntegrationStatus.planned,
        capabilities=["onchain_indexing", "pool_history"],
        d3vonn_use_cases=[
            "Historical swap/fee/liquidity analysis",
            "Pool performance datasets",
            "Risk-model feature generation",
        ],
        adapter_endpoint="/api/opensource/providers/graph_node/invoke",
    ),
    "uniswap_v4": IntegrationProvider(
        key="uniswap_v4",
        name="Uniswap v4 Core / Hooks",
        source_url="https://github.com/Uniswap/v4-core",
        replaces="Custom concentrated-liquidity protocol primitives",
        tier=IntegrationTier.tier_2,
        status=IntegrationStatus.planned,
        capabilities=["uniswap_v4_hooks", "liquidity_primitives"],
        d3vonn_use_cases=[
            "Future v4 pool integration",
            "Liquidity hook research",
            "Policy-aware automated-liquidity architecture",
        ],
        adapter_endpoint="/api/opensource/providers/uniswap_v4/invoke",
        caution="Custom hooks require dedicated smart-contract audit and a separate production gate.",
    ),
    "fincept": IntegrationProvider(
        key="fincept",
        name="Fincept Terminal",
        source_url="https://github.com/Fincept-Corporation/FinceptTerminal",
        replaces="Bloomberg-style analytics terminal",
        tier=IntegrationTier.tier_3,
        status=IntegrationStatus.planned,
        capabilities=["financial_analytics", "portfolio_research", "market_data_connectors", "investment_agents"],
        d3vonn_use_cases=[
            "Opportunity Intelligence",
            "Tokenized real-estate analysis",
            "Portfolio and RWA dashboard research",
        ],
        adapter_endpoint="/api/opensource/providers/fincept/invoke",
        caution="Research only. Do not present output as financial advice.",
        env_vars=["FINCEPT_BASE_URL", "FINCEPT_API_KEY"],
    ),
    "autohedge": IntegrationProvider(
        key="autohedge",
        name="AutoHedge",
        source_url="https://github.com/The-Swarm-Corporation/AutoHedge",
        replaces="Quant trading desk research workflow",
        tier=IntegrationTier.tier_3,
        status=IntegrationStatus.disabled,
        capabilities=["quant_research", "risk_review", "execution_research"],
        d3vonn_use_cases=["Long-term quant research lab only"],
        caution="Disabled by default. Never connect live funds without legal, compliance, risk, and security review.",
    ),
    "vibe_trading": IntegrationProvider(
        key="vibe_trading",
        name="Vibe-Trading",
        source_url="https://github.com/HKUDS/Vibe-Trading",
        replaces="DAG-driven trading floor research workflow",
        tier=IntegrationTier.tier_3,
        status=IntegrationStatus.disabled,
        capabilities=["trading_research_dag", "agent_debate", "market_research"],
        d3vonn_use_cases=["Long-term investment research architecture inspiration"],
        caution="Disabled by default. Research only; not financial advice or trade execution.",
    ),
    "camofox": IntegrationProvider(
        key="camofox",
        name="Camofox",
        source_url="https://github.com/jo-inc/camofox-browser",
        replaces="Commercial browser automation APIs",
        tier=IntegrationTier.tier_4,
        status=IntegrationStatus.disabled,
        capabilities=["authorized_browser_automation", "accessibility_tree_extraction"],
        d3vonn_use_cases=[
            "Only user-authorized browser automation",
            "Accessibility-tree extraction for compliant workflows",
        ],
        caution="Stealth or bot-detection evasion is not a D3VONN core feature. Use only for transparent, authorized automation that respects site terms and laws.",
    ),
}


def list_providers(tier: Optional[IntegrationTier] = None) -> List[IntegrationProvider]:
    """Return registered providers, optionally filtered by strategic tier."""
    providers = list(PROVIDERS.values())
    if tier:
        providers = [provider for provider in providers if provider.tier == tier]
    return sorted(providers, key=lambda provider: (provider.tier.value, provider.name))


def get_provider(key: str) -> Optional[IntegrationProvider]:
    """Return a provider by registry key."""
    return PROVIDERS.get(key)
