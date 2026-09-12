"""Pinned upstream catalog ingestion for D3VONN visual intelligence.

The upstream repository is deliberately pinned to an immutable commit.  Runtime
code never accepts an arbitrary URL, which keeps this importer out of the SSRF
business and makes catalog changes reviewable/reproducible.
"""
from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from typing import Any
from urllib.request import Request, urlopen

from backend.visual_intelligence.style_library import VisualStyle

UPSTREAM_REPOSITORY = "freestylefly/awesome-gpt-image-2"
UPSTREAM_COMMIT = "0dc09c46c8a30b1fdd89c18cc78a894dac2104e3"
UPSTREAM_CATALOG_PATH = "data/style-library.json"
UPSTREAM_CATALOG_URL = (
    "https://raw.githubusercontent.com/"
    f"{UPSTREAM_REPOSITORY}/{UPSTREAM_COMMIT}/{UPSTREAM_CATALOG_PATH}"
)
UPSTREAM_LICENSE = "MIT"
MAX_CATALOG_BYTES = 256 * 1024


class UpstreamCatalogError(RuntimeError):
    """Raised when the pinned catalog cannot be fetched or normalized safely."""


def source_manifest() -> dict[str, object]:
    return {
        "repository": UPSTREAM_REPOSITORY,
        "commit": UPSTREAM_COMMIT,
        "path": UPSTREAM_CATALOG_PATH,
        "url": UPSTREAM_CATALOG_URL,
        "license": UPSTREAM_LICENSE,
        "max_bytes": MAX_CATALOG_BYTES,
    }


def fetch_pinned_catalog(
    *,
    timeout: float = 5.0,
    opener: Callable[..., Any] = urlopen,
) -> Mapping[str, Any]:
    """Fetch the immutable upstream style catalog with a strict size cap."""
    request = Request(
        UPSTREAM_CATALOG_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "D3VONN-Visual-Intelligence/1.0",
        },
        method="GET",
    )
    try:
        with opener(request, timeout=timeout) as response:
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    declared_size = int(content_length)
                except ValueError as exc:
                    raise UpstreamCatalogError("invalid upstream content-length") from exc
                if declared_size > MAX_CATALOG_BYTES:
                    raise UpstreamCatalogError("upstream catalog exceeds size limit")
            raw = response.read(MAX_CATALOG_BYTES + 1)
    except UpstreamCatalogError:
        raise
    except Exception as exc:  # network/HTTP failures are normalized for callers
        raise UpstreamCatalogError("unable to fetch pinned upstream catalog") from exc

    if len(raw) > MAX_CATALOG_BYTES:
        raise UpstreamCatalogError("upstream catalog exceeds size limit")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise UpstreamCatalogError("upstream catalog is not valid UTF-8 JSON") from exc
    if not isinstance(payload, dict):
        raise UpstreamCatalogError("upstream catalog root must be an object")
    return payload


def normalize_catalog(payload: Mapping[str, Any]) -> tuple[VisualStyle, ...]:
    """Convert upstream industrial templates into D3VONN provider-neutral styles."""
    templates = payload.get("templates")
    if not isinstance(templates, list):
        raise UpstreamCatalogError("upstream catalog is missing templates")

    normalized: list[VisualStyle] = []
    seen_ids: set[str] = set()
    for item in templates:
        if not isinstance(item, dict):
            continue
        raw_id = _clean_text(item.get("id"))
        if not raw_id:
            continue
        style_id = f"awesome-gpt-image-2:{raw_id}"
        if style_id in seen_ids:
            raise UpstreamCatalogError(f"duplicate upstream template id: {raw_id}")
        seen_ids.add(style_id)

        title = _localized_text(item.get("title")) or raw_id.replace("-", " ").title()
        category = _clean_text(item.get("category")) or "other"
        description = _localized_text(item.get("description"))
        use_when = _localized_text(item.get("useWhen"))
        guidance = _localized_list(item.get("guidance"))
        pitfalls = _localized_list(item.get("pitfalls"))

        prompt_fragments = tuple(
            value
            for value in (description, use_when, *guidance)
            if value
        )
        tags = frozenset(
            _clean_text(value)
            for value in (
                *(item.get("styles") or []),
                *(item.get("scenes") or []),
                *(item.get("tags") or []),
            )
            if _clean_text(value)
        )
        normalized.append(
            VisualStyle(
                style_id=style_id,
                name=title,
                category=category,
                prompt_fragments=prompt_fragments,
                negative_fragments=tuple(pitfalls),
                tags=tags,
                source=f"github:{UPSTREAM_REPOSITORY}@{UPSTREAM_COMMIT}",
            )
        )

    if not normalized:
        raise UpstreamCatalogError("upstream catalog contains no usable templates")
    return tuple(normalized)


def fetch_and_normalize(*, timeout: float = 5.0) -> tuple[VisualStyle, ...]:
    return normalize_catalog(fetch_pinned_catalog(timeout=timeout))


def _localized_text(value: object) -> str:
    if isinstance(value, str):
        return _clean_text(value)
    if isinstance(value, dict):
        return _clean_text(value.get("en")) or _clean_text(value.get("zh"))
    return ""


def _localized_list(value: object) -> list[str]:
    if isinstance(value, dict):
        selected = value.get("en") if isinstance(value.get("en"), list) else value.get("zh")
    else:
        selected = value
    if not isinstance(selected, list):
        return []
    return [text for item in selected if (text := _clean_text(item))]


def _clean_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())
