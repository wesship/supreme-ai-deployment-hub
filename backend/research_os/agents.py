"""The six Hermes Research OS agents.

These agents are deliberately lightweight, deterministic, and composable so they
can be called by Hermes DAGs, HTTP routes, schedulers, or future marketplace
agent wrappers.
"""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
from typing import Iterable

import httpx

from .adapters import build_adapters
from .models import (
    DKOSWriteResult,
    EvidenceItem,
    LeadCandidate,
    LeadEnrichmentResult,
    ResearchIntent,
    ResearchPlan,
    ResearchQueryRequest,
    ResearchSource,
    SourceRoute,
)


class ResearchRouterAgent:
    """Routes user intent to the best external research sources."""

    def plan(self, request: ResearchQueryRequest) -> ResearchPlan:
        query = f"{request.query} {request.objective or ''}".lower()
        requested = request.sources
        intent = self._detect_intent(query, request.enrich_leads)
        routes = self._routes_for(intent, query)

        if requested:
            requested_set = set(requested)
            routes = [r for r in routes if r.source in requested_set]
            missing = requested_set - {r.source for r in routes}
            routes.extend(SourceRoute(source=s, reason="User-requested source", priority=7) for s in missing)

        if not routes:
            routes = [SourceRoute(source=ResearchSource.web, reason="Fallback general research source", priority=5)]

        routes = sorted(routes, key=lambda r: r.priority, reverse=True)
        return ResearchPlan(
            intent=intent,
            routes=routes,
            token_strategy="collect_snippets_rank_first_then_send_top_evidence_to_reasoning_model",
            lead_enrichment_recommended=intent in {ResearchIntent.lead_generation, ResearchIntent.competitive_intel} or request.enrich_leads,
        )

    def _detect_intent(self, query: str, enrich_leads: bool) -> ResearchIntent:
        if enrich_leads or any(w in query for w in ("lead", "prospect", "email", "decision maker", "sales", "buyer")):
            return ResearchIntent.lead_generation
        if any(w in query for w in ("competitor", "pricing", "funding", "market map", "alternative")):
            return ResearchIntent.competitive_intel
        if any(w in query for w in ("reddit", "pain point", "complaint", "sentiment", "trend", "viral")):
            return ResearchIntent.market_sentiment
        if any(w in query for w in ("github", "repo", "api", "sdk", "install", "code", "technical")):
            return ResearchIntent.technical
        if any(w in query for w in ("youtube", "script", "content", "video", "creator")):
            return ResearchIntent.content_research
        return ResearchIntent.general

    def _routes_for(self, intent: ResearchIntent, query: str) -> list[SourceRoute]:
        route_map: dict[ResearchIntent, list[SourceRoute]] = {
            ResearchIntent.technical: [
                SourceRoute(source=ResearchSource.github, reason="Code, repos, SDKs, and implementation evidence", priority=10),
                SourceRoute(source=ResearchSource.web, reason="Official docs and technical writeups", priority=8),
                SourceRoute(source=ResearchSource.reddit, reason="Developer pain points and field reports", priority=6),
            ],
            ResearchIntent.lead_generation: [
                SourceRoute(source=ResearchSource.linkedin, reason="Company/person targeting and role context", priority=10),
                SourceRoute(source=ResearchSource.web, reason="Company websites and source verification", priority=8),
                SourceRoute(source=ResearchSource.github, reason="Technology adoption and engineering signals", priority=6),
                SourceRoute(source=ResearchSource.reddit, reason="Pain-point communities and buying intent", priority=5),
            ],
            ResearchIntent.competitive_intel: [
                SourceRoute(source=ResearchSource.web, reason="Company pages, changelogs, and pricing pages", priority=10),
                SourceRoute(source=ResearchSource.github, reason="Open-source velocity and developer traction", priority=8),
                SourceRoute(source=ResearchSource.x, reason="Recent launch and market conversation signals", priority=7),
                SourceRoute(source=ResearchSource.youtube, reason="Founder interviews, demos, and reviews", priority=6),
            ],
            ResearchIntent.market_sentiment: [
                SourceRoute(source=ResearchSource.reddit, reason="Authentic pain points and user language", priority=10),
                SourceRoute(source=ResearchSource.x, reason="Fast-moving conversation and trend signals", priority=9),
                SourceRoute(source=ResearchSource.youtube, reason="Review and education narratives", priority=6),
            ],
            ResearchIntent.content_research: [
                SourceRoute(source=ResearchSource.youtube, reason="Video topic, script, and creator research", priority=10),
                SourceRoute(source=ResearchSource.x, reason="Current angles and hooks", priority=8),
                SourceRoute(source=ResearchSource.reddit, reason="Audience objections and questions", priority=7),
            ],
            ResearchIntent.general: [
                SourceRoute(source=ResearchSource.web, reason="General web evidence", priority=8),
                SourceRoute(source=ResearchSource.reddit, reason="Community validation", priority=5),
                SourceRoute(source=ResearchSource.github, reason="Technical/source credibility checks", priority=4),
            ],
        }
        return route_map[intent]


class AgentReachCollectorAgent:
    """Runs selected source adapters in parallel."""

    def __init__(self):
        self.adapters = build_adapters()

    async def collect(self, query: str, routes: Iterable[SourceRoute], limit: int = 5) -> list[EvidenceItem]:
        async def run(route: SourceRoute) -> list[EvidenceItem]:
            adapter = self.adapters.get(route.source)
            if not adapter:
                return []
            try:
                return await adapter.search(query, limit=limit)
            except Exception as exc:
                return [
                    EvidenceItem(
                        source=route.source,
                        title=f"{route.source.value} adapter unavailable",
                        snippet=str(exc),
                        raw={"error": str(exc), "route_reason": route.reason},
                    )
                ]

        chunks = await asyncio.gather(*(run(route) for route in routes))
        return [item for chunk in chunks for item in chunk]

    def health(self):
        return [adapter.health() for adapter in self.adapters.values()]


class EvidenceRankerAgent:
    """Scores evidence before any expensive reasoning call sees it."""

    SOURCE_WEIGHTS = {
        ResearchSource.github: 0.82,
        ResearchSource.youtube: 0.70,
        ResearchSource.reddit: 0.74,
        ResearchSource.x: 0.66,
        ResearchSource.linkedin: 0.78,
        ResearchSource.web: 0.72,
        ResearchSource.rss: 0.76,
    }

    def rank(self, query: str, evidence: list[EvidenceItem], limit: int = 25) -> list[EvidenceItem]:
        query_terms = {t for t in re.findall(r"[a-zA-Z0-9]{3,}", query.lower()) if t not in {"the", "and", "for", "with"}}
        seen: set[str] = set()
        ranked: list[EvidenceItem] = []
        for item in evidence:
            key = (item.url or item.title).lower().strip()
            if key in seen:
                continue
            seen.add(key)
            text = f"{item.title} {item.snippet}".lower()
            matches = sum(1 for t in query_terms if t in text)
            relevance = matches / max(len(query_terms), 1)
            source_score = self.SOURCE_WEIGHTS.get(item.source, 0.6)
            freshness = self._freshness_score(item.published_at)
            has_url = 0.08 if item.url else 0.0
            item.score = round((relevance * 0.48) + (source_score * 0.32) + (freshness * 0.12) + has_url, 4)
            item.score_reasons = [
                f"relevance={relevance:.2f}",
                f"source_weight={source_score:.2f}",
                f"freshness={freshness:.2f}",
            ]
            ranked.append(item)
        return sorted(ranked, key=lambda i: i.score, reverse=True)[:limit]

    def _freshness_score(self, dt: datetime | None) -> float:
        if not dt:
            return 0.45
        age_days = max((datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).days, 0)
        if age_days <= 7:
            return 1.0
        if age_days <= 30:
            return 0.82
        if age_days <= 180:
            return 0.62
        if age_days <= 730:
            return 0.40
        return 0.20


class LeadEnrichmentAgent:
    """Extracts leads and pushes them to a Clay webhook when configured."""

    COMPANY_RE = re.compile(r"\b([A-Z][A-Za-z0-9&.\- ]{2,40}\s(?:AI|Inc|LLC|Ltd|Technologies|Systems|Labs|Group|Health|Insurance|Automation))\b")

    def extract(self, evidence: list[EvidenceItem]) -> list[LeadCandidate]:
        candidates: list[LeadCandidate] = []
        seen: set[str] = set()
        for item in evidence:
            raw_text = f"{item.title} {item.snippet}"
            for company in self.COMPANY_RE.findall(raw_text):
                key = company.lower()
                if key in seen:
                    continue
                seen.add(key)
                candidates.append(
                    LeadCandidate(
                        company=company.strip(),
                        website=self._domain_from_url(item.url),
                        source_url=item.url,
                        confidence=min(0.95, max(0.55, item.score)),
                        metadata={"source": item.source.value, "title": item.title},
                    )
                )
        return candidates[:50]

    async def enrich(self, leads: list[LeadCandidate]) -> LeadEnrichmentResult:
        webhook = os.getenv("CLAY_WEBHOOK_URL")
        if not webhook:
            return LeadEnrichmentResult(status="skipped", clay_webhook_configured=False, submitted=0, records=leads, message="Set CLAY_WEBHOOK_URL to queue leads in Clay.")
        if not leads:
            return LeadEnrichmentResult(status="skipped", clay_webhook_configured=True, submitted=0, records=[])
        payload = {"records": [lead.model_dump() for lead in leads], "source": "d3vonn_research_os"}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(webhook, json=payload)
                resp.raise_for_status()
            return LeadEnrichmentResult(status="queued", clay_webhook_configured=True, submitted=len(leads), records=leads)
        except Exception as exc:
            return LeadEnrichmentResult(status="failed", clay_webhook_configured=True, submitted=0, records=leads, message=str(exc))

    def _domain_from_url(self, url: str | None) -> str | None:
        if not url:
            return None
        return re.sub(r"^https?://", "", url).split("/")[0]


class GrokTrendAgent:
    """Specialist agent for X/Grok trend routing.

    Actual Grok OAuth execution can remain in Hermes. This class exposes a
    uniform planning/extraction surface so Hermes knows when X/Grok should run.
    """

    def should_use(self, query: str) -> bool:
        q = query.lower()
        return any(w in q for w in ("latest", "trend", "x ", "twitter", "viral", "breaking", "launch"))

    def prompt(self, query: str) -> str:
        return (
            "Use Grok/X only for recent public conversation signals. "
            "Return claims with URLs, author handles, timestamps, and confidence. "
            f"Research query: {query}"
        )


class DKOSMemoryWriterAgent:
    """Persists research outputs into DKOS-compatible storage.

    If Supabase service credentials are configured, writes to the table named by
    DKOS_RESEARCH_TABLE, defaulting to dkos_research_evidence. Otherwise it
    reports a safe skip.
    """

    async def save(self, request: ResearchQueryRequest, evidence: list[EvidenceItem], leads: list[LeadCandidate]) -> DKOSWriteResult:
        if not request.save_to_dkos:
            return DKOSWriteResult(status="skipped", records=0, message="Request disabled DKOS save.")
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        table = os.getenv("DKOS_RESEARCH_TABLE", "dkos_research_evidence")
        if not url or not key:
            return DKOSWriteResult(status="skipped", records=0, message="SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not configured.")
        rows = [
            {
                "tenant_id": request.tenant_id,
                "query": request.query,
                "source": item.source.value,
                "title": item.title,
                "url": item.url,
                "snippet": item.snippet[:4_000],
                "score": item.score,
                "raw": item.raw,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            for item in evidence
        ]
        if not rows:
            return DKOSWriteResult(status="skipped", records=0, message="No evidence to save.")
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(f"{url.rstrip('/')}/rest/v1/{table}", headers=headers, json=rows)
                resp.raise_for_status()
            return DKOSWriteResult(status="saved", records=len(rows))
        except Exception as exc:
            return DKOSWriteResult(status="failed", records=0, message=str(exc))
