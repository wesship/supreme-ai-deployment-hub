"""Governed VFX asset routing for D3VONN.IO AI Films.

MakeBIGFILMS is integrated as a catalog-routing provider, not as an executable
render/download API. The public platform exposes curated VFX collections and a
project workspace, but D3VONN must not imply that licensed assets can be fetched
without an operator-authorized import path.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from urllib.parse import quote

MAKEBIGFILMS_BASE_URL = "https://www.makebigfilms.com"
MAKEBIGFILMS_PROJECTS_URL = f"{MAKEBIGFILMS_BASE_URL}/projects"

# Public collection catalog verified against MakeBIGFILMS in September 2026.
MAKEBIGFILMS_COLLECTIONS: tuple[str, ...] = (
    "kaiju",
    "nuclear",
    "destruction",
    "cataclysm",
    "dragons",
    "storms",
    "swat",
    "helicopters",
    "sci-fi",
    "robots",
    "planes",
    "tanks",
    "explosions",
    "fire",
    "zombies crowds",
    "wasteland crowds",
    "spaceships",
    "universe",
    "dinosaurs",
    "snakes",
    "magic",
    "superheroes",
    "environments",
    "post-apocalyptic",
    "sci-fi worlds",
    "planets",
    "fantasy",
    "western",
    "action",
    "technology",
    "motion design",
    "light overlays",
)

# Compact scene-language taxonomy used by Hermes / AI Director to bridge a
# screenplay or shot manifest to candidate VFX collections.
_COLLECTION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "kaiju": ("kaiju", "giant monster", "colossal creature", "godzilla"),
    "nuclear": ("nuclear", "atomic", "mushroom cloud", "shockwave", "radiation"),
    "destruction": ("destruction", "collapse", "building collapse", "debris", "ruins"),
    "cataclysm": ("cataclysm", "disaster", "apocalypse", "city-wide", "citywide"),
    "dragons": ("dragon", "dragons", "winged beast"),
    "storms": ("storm", "storms", "tornado", "hurricane", "cloudburst", "weather"),
    "swat": ("swat", "tactical team", "police raid", "breach team"),
    "helicopters": ("helicopter", "helicopters", "chopper", "rotorcraft"),
    "sci-fi": ("sci-fi", "science fiction", "futuristic", "alien", "hologram"),
    "robots": ("robot", "robots", "mech", "mecha", "android"),
    "planes": ("plane", "planes", "aircraft", "fighter jet", "jet"),
    "tanks": ("tank", "tanks", "armored vehicle"),
    "explosions": ("explosion", "explosions", "blast", "detonation", "fireball"),
    "fire": ("fire", "flame", "flames", "embers", "burning"),
    "zombies crowds": ("zombie", "zombies", "undead crowd"),
    "wasteland crowds": ("wasteland crowd", "survivor crowd", "refugee crowd"),
    "spaceships": ("spaceship", "spaceships", "starship", "spacecraft", "ufo"),
    "universe": ("universe", "galaxy", "cosmos", "cosmic", "nebula", "deep space"),
    "dinosaurs": ("dinosaur", "dinosaurs", "t-rex", "trex", "raptor"),
    "snakes": ("snake", "snakes", "serpent"),
    "magic": ("magic", "spell", "energy portal", "portal", "mystic", "arcane"),
    "superheroes": ("superhero", "superheroes", "electricity", "lightning", "power effect"),
    "environments": ("environment", "landscape", "cityscape", "background plate", "set extension"),
    "post-apocalyptic": ("post-apocalyptic", "post apocalyptic", "wasteland", "ruined city"),
    "sci-fi worlds": ("sci-fi world", "alien world", "future world", "impossible architecture"),
    "planets": ("planet", "planets", "moon", "orbital body"),
    "fantasy": ("fantasy", "mythic", "enchanted", "medieval fantasy"),
    "western": ("western", "cowboy", "old west", "frontier"),
    "action": ("action", "gunfight", "chase", "stunt", "combat"),
    "technology": ("technology", "interface", "hud", "screen graphic", "data visualization"),
    "motion design": ("motion design", "title design", "3d text", "graphic transition", "geometric"),
    "light overlays": ("light overlay", "anamorphic", "bokeh", "lens flare", "light leak", "reflection"),
}

_CAMERA_ALIASES = {
    "front": "front",
    "front left": "front-left",
    "front right": "front-right",
    "left": "left",
    "right": "right",
    "back": "back",
    "back left": "back-left",
    "back right": "back-right",
    "rear": "back",
    "rear left": "back-left",
    "rear right": "back-right",
}


@dataclass(frozen=True)
class VFXCandidate:
    collection: str
    score: int
    matched_terms: tuple[str, ...]
    collection_url: str
    camera_direction: str | None = None

    def as_dict(self) -> dict[str, object]:
        return {
            "provider": "makebigfilms",
            "collection": self.collection,
            "score": self.score,
            "matched_terms": list(self.matched_terms),
            "collection_url": self.collection_url,
            "camera_direction": self.camera_direction,
            "licensed_asset_required": True,
        }


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def normalize_camera_direction(value: str | None) -> str | None:
    if not value:
        return None
    normalized = _normalize(value).replace("_", "-").replace("-", " ")
    return _CAMERA_ALIASES.get(normalized, normalized.replace(" ", "-"))


def makebigfilms_collection_url(collection: str) -> str:
    if collection not in MAKEBIGFILMS_COLLECTIONS:
        raise ValueError(f"Unknown MakeBIGFILMS collection: {collection}")
    return f"{MAKEBIGFILMS_BASE_URL}/collections/{quote(collection)}"


def catalog() -> dict[str, object]:
    return {
        "provider": "makebigfilms",
        "capability": "vfx_asset",
        "integration_mode": "catalog_routing",
        "execution_mode": "operator_authorized_asset_import",
        "collection_count": len(MAKEBIGFILMS_COLLECTIONS),
        "collections": [
            {"name": name, "url": makebigfilms_collection_url(name)}
            for name in MAKEBIGFILMS_COLLECTIONS
        ],
        "projects_url": os.getenv("MAKEBIGFILMS_PROJECT_URL", "").strip() or MAKEBIGFILMS_PROJECTS_URL,
        "guardrails": {
            "automatic_download": False,
            "license_provenance_required": True,
            "source_of_record": "d3vonn_ai_films",
        },
    }


def resolve_vfx_assets(
    scene_description: str,
    *,
    requested_effects: tuple[str, ...] = (),
    camera_direction: str | None = None,
    limit: int = 6,
) -> dict[str, object]:
    """Rank MakeBIGFILMS collections for a scene without downloading assets."""
    if not scene_description.strip() and not requested_effects:
        raise ValueError("scene_description or requested_effects is required")
    if limit < 1 or limit > 12:
        raise ValueError("limit must be between 1 and 12")

    haystack = _normalize(" ".join((scene_description, *requested_effects)))
    candidates: list[VFXCandidate] = []
    normalized_camera = normalize_camera_direction(camera_direction)

    for collection in MAKEBIGFILMS_COLLECTIONS:
        terms = _COLLECTION_KEYWORDS.get(collection, ())
        matched = tuple(term for term in terms if term in haystack)
        if not matched:
            continue
        # Prefer explicit multi-word matches while remaining deterministic.
        score = sum(2 if " " in term or "-" in term else 1 for term in matched)
        candidates.append(
            VFXCandidate(
                collection=collection,
                score=score,
                matched_terms=matched,
                collection_url=makebigfilms_collection_url(collection),
                camera_direction=normalized_camera,
            )
        )

    # Fallback collections keep the planner useful for unfamiliar scene language
    # while making it explicit that this is a broad recommendation.
    if not candidates:
        fallback = ("environments", "sci-fi", "light overlays")
        candidates = [
            VFXCandidate(
                collection=name,
                score=0,
                matched_terms=(),
                collection_url=makebigfilms_collection_url(name),
                camera_direction=normalized_camera,
            )
            for name in fallback
        ]

    candidates.sort(key=lambda item: (-item.score, item.collection))
    ranked = candidates[:limit]
    return {
        "provider": "makebigfilms",
        "capability": "vfx_asset",
        "integration_mode": "catalog_routing",
        "scene": scene_description,
        "camera_direction": normalized_camera,
        "candidates": [item.as_dict() for item in ranked],
        "handoff": {
            "next_stage": "licensed_asset_import_then_compositing",
            "compatible_pipeline": ["artifact_store", "openexr", "assembly"],
            "automatic_download": False,
            "license_provenance_required": True,
        },
    }
