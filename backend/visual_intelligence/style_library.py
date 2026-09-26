"""Provider-neutral visual prompt compilation for D3VONN."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping, Sequence


@dataclass(frozen=True)
class VisualStyle:
    style_id: str
    name: str
    category: str
    prompt_fragments: tuple[str, ...] = ()
    negative_fragments: tuple[str, ...] = ()
    tags: frozenset[str] = field(default_factory=frozenset)
    source: str = "d3vonn"


@dataclass(frozen=True)
class CompiledVisualPrompt:
    prompt: str
    negative_prompt: str | None
    style_id: str | None
    category: str | None
    source: str | None
    metadata: Mapping[str, object]


DEFAULT_STYLES: tuple[VisualStyle, ...] = (
    VisualStyle(
        "commercial-luxury-product",
        "Luxury Product Campaign",
        "product",
        (
            "premium commercial product photography",
            "controlled studio lighting",
            "clean luxury composition",
            "high material fidelity",
        ),
        ("warped packaging", "illegible branding", "visual clutter"),
        frozenset({"product", "commerce", "luxury", "advertising", "photography"}),
    ),
    VisualStyle(
        "cinematic-storyboard",
        "Cinematic Storyboard",
        "storytelling",
        (
            "cinematic composition",
            "clear subject blocking and depth staging",
            "intentional lens language",
            "motivated lighting",
        ),
        ("ambiguous staging", "flat lighting"),
        frozenset({"film", "storyboard", "cinematic", "previs"}),
    ),
    VisualStyle(
        "product-ui-concept",
        "Product UI Concept",
        "ui",
        (
            "polished product interface concept",
            "strong information hierarchy",
            "consistent spacing",
            "legible interface typography",
        ),
        ("garbled text", "inconsistent spacing", "decorative clutter"),
        frozenset({"ui", "ux", "dashboard", "product", "interface"}),
    ),
    VisualStyle(
        "technical-infographic",
        "Technical Infographic",
        "infographic",
        (
            "clear technical infographic",
            "structured visual hierarchy",
            "diagram-first communication",
            "clean data visualization",
        ),
        ("dense paragraphs", "unreadable labels", "ornamental noise"),
        frozenset({"diagram", "infographic", "architecture", "data"}),
    ),
)


class VisualStyleLibrary:
    def __init__(self, styles: Iterable[VisualStyle] = DEFAULT_STYLES) -> None:
        self._styles = {style.style_id: style for style in styles}

    def list_styles(self) -> list[VisualStyle]:
        return sorted(self._styles.values(), key=lambda item: (item.category, item.name))

    def get(self, style_id: str) -> VisualStyle | None:
        return self._styles.get(style_id)

    def search(self, query: str, *, limit: int = 5) -> list[VisualStyle]:
        terms = {term for term in query.lower().replace("-", " ").split() if term}
        ranked: list[tuple[int, str, VisualStyle]] = []
        for style in self._styles.values():
            text = " ".join((style.style_id, style.name, style.category, *style.tags)).lower()
            score = sum(1 for term in terms if term in text)
            if score:
                ranked.append((score, style.name, style))
        ranked.sort(key=lambda item: (-item[0], item[1]))
        return [item[2] for item in ranked[: max(1, limit)]]

    def compile(
        self,
        request: str,
        *,
        style_id: str | None = None,
        constraints: Sequence[str] = (),
        negative_constraints: Sequence[str] = (),
        metadata: Mapping[str, object] | None = None,
    ) -> CompiledVisualPrompt:
        cleaned_request = " ".join(request.split())
        if not cleaned_request:
            raise ValueError("request must not be empty")

        style = self.get(style_id) if style_id else None
        if style_id and style is None:
            raise KeyError(f"unknown visual style: {style_id}")

        prompt_parts = [cleaned_request]
        negative_parts: list[str] = []
        if style:
            prompt_parts.extend(style.prompt_fragments)
            negative_parts.extend(style.negative_fragments)
        prompt_parts.extend(_clean(constraints))
        negative_parts.extend(_clean(negative_constraints))

        compiled_metadata = dict(metadata or {})
        compiled_metadata.update({"compiler": "d3vonn.visual_intelligence.v1", "style_applied": bool(style)})

        return CompiledVisualPrompt(
            prompt=", ".join(_dedupe(prompt_parts)),
            negative_prompt=", ".join(_dedupe(negative_parts)) or None,
            style_id=style.style_id if style else None,
            category=style.category if style else None,
            source=style.source if style else None,
            metadata=compiled_metadata,
        )


def _clean(values: Sequence[str]) -> list[str]:
    return [" ".join(value.split()) for value in values if value and value.strip()]


def _dedupe(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.casefold()
        if value and key not in seen:
            seen.add(key)
            result.append(value)
    return result
