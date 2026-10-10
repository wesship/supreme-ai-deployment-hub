"""Source adapters for Hermes Research OS.

The adapters prefer Agent Reach when installed, then fall back to safe public
HTTP endpoints where possible. Missing credentials degrade gracefully so the
router can still answer with source health instead of failing the backend.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any, Protocol

import httpx

from .models import EvidenceItem, ResearchSource, SourceHealth


class SourceAdapter(Protocol):
    source: ResearchSource

    async def search(self, query: str, limit: int = 5) -> list[EvidenceItem]:
        ...

    def health(self) -> SourceHealth:
        ...


class BaseAdapter:
    source: ResearchSource

    def health(self) -> SourceHealth:
        return SourceHealth(source=self.source.value, status="optional", detail="Adapter is available.")

    async def _agent_reach(self, query: str, limit: int) -> list[EvidenceItem]:
        """Attempt Agent Reach dynamically without making it a hard import."""
        try:
            import agent_reach  # type: ignore
        except Exception:
            return []

        # Agent Reach APIs may evolve; keep this dynamic and defensive.
        for attr in ("search", "run", "collect"):
            fn = getattr(agent_reach, attr, None)
            if callable(fn):
                result = fn(source=self.source.value, query=query, limit=limit)
                if asyncio.iscoroutine(result):
                    result = await result
                return self._normalize_agent_reach(result)
        return []

    def _normalize_agent_reach(self, result: Any) -> list[EvidenceItem]:
        if not result:
            return []
        items = result if isinstance(result, list) else result.get("results", []) if isinstance(result, dict) else []
        normalized: list[EvidenceItem] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            normalized.append(
                EvidenceItem(
                    source=self.source,
                    title=str(item.get("title") or item.get("name") or "Untitled result"),
                    url=item.get("url") or item.get("link"),
                    snippet=str(item.get("snippet") or item.get("description") or item.get("text") or ""),
                    author=item.get("author") or item.get("owner"),
                    raw=item,
                )
            )
        return normalized


class GitHubAdapter(BaseAdapter):
    source = ResearchSource.github

    def health(self) -> SourceHealth:
        token = bool(os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN"))
        return SourceHealth(
            source=self.source.value,
            status="configured" if token else "degraded",
            detail="GitHub token configured." if token else "Using unauthenticated GitHub search fallback.",
        )

    async def search(self, query: str, limit: int = 5) -> list[EvidenceItem]:
        agent_results = await self._agent_reach(query, limit)
        if agent_results:
            return agent_results[:limit]

        headers = {"Accept": "application/vnd.github+json"}
        token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        params = {"q": query, "per_page": min(limit, 10), "sort": "updated", "order": "desc"}
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get("https://api.github.com/search/repositories", params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        return [
            EvidenceItem(
                source=self.source,
                title=item.get("full_name", "GitHub repository"),
                url=item.get("html_url"),
                snippet=item.get("description") or "",
                author=(item.get("owner") or {}).get("login"),
                raw=item,
            )
            for item in data.get("items", [])[:limit]
        ]


class YouTubeAdapter(BaseAdapter):
    source = ResearchSource.youtube

    def health(self) -> SourceHealth:
        return SourceHealth(
            source=self.source.value,
            status="configured" if os.getenv("YOUTUBE_API_KEY") else "degraded",
            detail="YouTube API key configured." if os.getenv("YOUTUBE_API_KEY") else "Agent Reach/public fallback only.",
        )

    async def search(self, query: str, limit: int = 5) -> list[EvidenceItem]:
        agent_results = await self._agent_reach(query, limit)
        if agent_results:
            return agent_results[:limit]
        api_key = os.getenv("YOUTUBE_API_KEY")
        if not api_key:
            return []
        params = {
            "part": "snippet",
            "q": query,
            "key": api_key,
            "type": "video",
            "maxResults": min(limit, 10),
            "order": "relevance",
        }
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get("https://www.googleapis.com/youtube/v3/search", params=params)
            resp.raise_for_status()
            data = resp.json()
        evidence: list[EvidenceItem] = []
        for item in data.get("items", [])[:limit]:
            snippet = item.get("snippet", {})
            video_id = (item.get("id") or {}).get("videoId")
            evidence.append(
                EvidenceItem(
                    source=self.source,
                    title=snippet.get("title", "YouTube video"),
                    url=f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
                    snippet=snippet.get("description") or "",
                    author=snippet.get("channelTitle"),
                    published_at=_parse_dt(snippet.get("publishedAt")),
                    raw=item,
                )
            )
        return evidence


class RedditAdapter(BaseAdapter):
    source = ResearchSource.reddit

    def health(self) -> SourceHealth:
        return SourceHealth(source=self.source.value, status="degraded", detail="Uses Reddit JSON public search fallback or Agent Reach.")

    async def search(self, query: str, limit: int = 5) -> list[EvidenceItem]:
        agent_results = await self._agent_reach(query, limit)
        if agent_results:
            return agent_results[:limit]
        params = {"q": query, "limit": min(limit, 10), "sort": "relevance", "t": "month"}
        headers = {"User-Agent": "DevonnAI-ResearchOS/1.0"}
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            resp = await client.get("https://www.reddit.com/search.json", params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        evidence: list[EvidenceItem] = []
        for child in data.get("data", {}).get("children", [])[:limit]:
            item = child.get("data", {})
            evidence.append(
                EvidenceItem(
                    source=self.source,
                    title=item.get("title", "Reddit discussion"),
                    url=f"https://www.reddit.com{item.get('permalink')}" if item.get("permalink") else None,
                    snippet=item.get("selftext") or item.get("subreddit_name_prefixed") or "",
                    author=item.get("author"),
                    published_at=datetime.fromtimestamp(item.get("created_utc"), tz=timezone.utc) if item.get("created_utc") else None,
                    raw=item,
                )
            )
        return evidence


class GrokXAdapter(BaseAdapter):
    source = ResearchSource.x

    def health(self) -> SourceHealth:
        configured = bool(os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY"))
        return SourceHealth(
            source=self.source.value,
            status="configured" if configured else "optional",
            detail="Grok/X key configured." if configured else "Hermes Grok OAuth or Agent Reach can provide this at runtime.",
        )

    async def search(self, query: str, limit: int = 5) -> list[EvidenceItem]:
        return (await self._agent_reach(query, limit))[:limit]


class GenericAgentReachAdapter(BaseAdapter):
    def __init__(self, source: ResearchSource):
        self.source = source

    async def search(self, query: str, limit: int = 5) -> list[EvidenceItem]:
        return (await self._agent_reach(query, limit))[:limit]


def build_adapters() -> dict[ResearchSource, SourceAdapter]:
    return {
        ResearchSource.github: GitHubAdapter(),
        ResearchSource.youtube: YouTubeAdapter(),
        ResearchSource.reddit: RedditAdapter(),
        ResearchSource.x: GrokXAdapter(),
        ResearchSource.linkedin: GenericAgentReachAdapter(ResearchSource.linkedin),
        ResearchSource.web: GenericAgentReachAdapter(ResearchSource.web),
        ResearchSource.rss: GenericAgentReachAdapter(ResearchSource.rss),
    }


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
