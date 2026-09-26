from __future__ import annotations

import pytest

from backend.visual_intelligence.upstream_catalog import (
    UPSTREAM_COMMIT,
    UpstreamCatalogError,
    normalize_catalog,
    source_manifest,
)

SAMPLE_CATALOG = {
    "templates": [
        {
            "id": "luxury-product-ad",
            "title": {"en": "Luxury Product Ad"},
            "description": {"en": "Premium product campaign composition."},
            "category": "Products & E-commerce",
            "styles": ["Product", "Realistic"],
            "scenes": ["Commerce"],
            "tags": ["Campaign"],
            "useWhen": {"en": "Use for hero product advertising."},
            "guidance": {"en": ["Lock the hero product and lighting."]},
            "pitfalls": {"en": ["Avoid warped packaging."]},
        }
    ]
}


def test_source_manifest_uses_pinned_commit() -> None:
    manifest = source_manifest()
    assert manifest["commit"] == UPSTREAM_COMMIT
    assert UPSTREAM_COMMIT in manifest["url"]
    assert manifest["license"] == "MIT"


def test_normalize_catalog_maps_template() -> None:
    styles = normalize_catalog(SAMPLE_CATALOG)
    assert len(styles) == 1
    style = styles[0]
    assert style.style_id == "awesome-gpt-image-2:luxury-product-ad"
    assert style.name == "Luxury Product Ad"
    assert style.category == "Products & E-commerce"
    assert "Avoid warped packaging." in style.negative_fragments
    assert UPSTREAM_COMMIT in style.source


def test_normalize_catalog_rejects_duplicate_ids() -> None:
    template = SAMPLE_CATALOG["templates"][0]
    with pytest.raises(UpstreamCatalogError, match="duplicate"):
        normalize_catalog({"templates": [template, template]})
