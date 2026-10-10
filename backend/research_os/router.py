"""FastAPI router for Hermes Research OS."""

from __future__ import annotations

from fastapi import APIRouter

from .agents import (
    AgentReachCollectorAgent,
    DKOSMemoryWriterAgent,
    EvidenceRankerAgent,
    GrokTrendAgent,
    LeadEnrichmentAgent,
    ResearchRouterAgent,
)
from .models import LeadCandidate, ResearchQueryRequest, ResearchQueryResponse

router = APIRouter(prefix="/api/research", tags=["research-os"])

router_agent = ResearchRouterAgent()
collector_agent = AgentReachCollectorAgent()
ranker_agent = EvidenceRankerAgent()
lead_agent = LeadEnrichmentAgent()
grok_agent = GrokTrendAgent()
dkos_agent = DKOSMemoryWriterAgent()


@router.post("/query", response_model=ResearchQueryResponse)
async def research_query(request: ResearchQueryRequest) -> ResearchQueryResponse:
    """Run a routed multi-source research job.

    This is the main Hermes Research OS endpoint. It routes the query, collects
    evidence from GitHub/YouTube/Reddit/X/etc., scores it before expensive model
    reasoning, optionally sends lead candidates to Clay, and optionally persists
    evidence into DKOS/Supabase.
    """
    plan = router_agent.plan(request)

    # Grok/X is a specialist overlay: add X route when the query needs trend data.
    if grok_agent.should_use(request.query) and not any(r.source.value == "x" for r in plan.routes):
        from .models import ResearchSource, SourceRoute

        plan.routes.append(SourceRoute(source=ResearchSource.x, reason="Grok/X trend overlay", priority=9))
        plan.routes = sorted(plan.routes, key=lambda r: r.priority, reverse=True)

    evidence = await collector_agent.collect(
        query=request.query,
        routes=plan.routes,
        limit=request.max_results_per_source,
    )
    ranked = ranker_agent.rank(request.query, evidence)

    leads: list[LeadCandidate] = []
    enrichment = None
    if request.enrich_leads or plan.lead_enrichment_recommended:
        leads = lead_agent.extract(ranked)
        enrichment = await lead_agent.enrich(leads)

    dkos = await dkos_agent.save(request, ranked, leads)
    summary = _build_summary(request.query, plan.intent.value, ranked, leads)

    return ResearchQueryResponse(
        query=request.query,
        plan=plan,
        evidence=ranked,
        leads=leads,
        enrichment=enrichment,
        dkos=dkos,
        summary=summary,
    )


@router.post("/collect")
async def collect_only(request: ResearchQueryRequest):
    plan = router_agent.plan(request)
    evidence = await collector_agent.collect(request.query, plan.routes, request.max_results_per_source)
    return {"plan": plan, "evidence": evidence}


@router.post("/rank")
async def rank_only(request: ResearchQueryRequest):
    plan = router_agent.plan(request)
    evidence = await collector_agent.collect(request.query, plan.routes, request.max_results_per_source)
    return {"evidence": ranker_agent.rank(request.query, evidence)}


@router.post("/leads/enrich")
async def enrich_leads(leads: list[LeadCandidate]):
    return await lead_agent.enrich(leads)


@router.get("/sources/health")
async def source_health():
    return {"sources": collector_agent.health()}


@router.get("/jobs/{job_id}")
async def job_status(job_id: str):
    # v1 executes synchronously. This keeps the contract ready for queued jobs.
    return {"job_id": job_id, "status": "completed_or_not_found", "mode": "sync_v1"}


def _build_summary(query: str, intent: str, evidence, leads) -> str:
    top = evidence[:3]
    source_counts: dict[str, int] = {}
    for item in evidence:
        source_counts[item.source.value] = source_counts.get(item.source.value, 0) + 1
    source_text = ", ".join(f"{source}:{count}" for source, count in sorted(source_counts.items())) or "no evidence"
    top_titles = "; ".join(item.title for item in top) if top else "No top results collected."
    return (
        f"Research OS completed query '{query}' with intent '{intent}'. "
        f"Collected/ranked {len(evidence)} evidence items across {source_text}. "
        f"Top evidence: {top_titles}. "
        f"Lead candidates extracted: {len(leads)}."
    )
