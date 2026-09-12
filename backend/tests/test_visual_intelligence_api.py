from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.middleware.auth import get_current_user_id
import backend.visual_intelligence.router as visual_router
from backend.visual_intelligence.style_library import VisualStyle


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(visual_router.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "visual-test-user"
    return TestClient(app)


def reset_registry() -> None:
    visual_router._registry = visual_router.CatalogRegistry()


def test_source_endpoint_reports_pin() -> None:
    reset_registry()
    response = make_client().get("/api/visual/source")
    assert response.status_code == 200
    body = response.json()
    assert body["upstream"]["license"] == "MIT"
    assert body["catalog"]["loaded"] is False


def test_style_search_and_compile_default_style() -> None:
    reset_registry()
    client = make_client()
    search = client.get("/api/visual/styles", params={"q": "luxury product"})
    assert search.status_code == 200
    assert search.json()["items"][0]["style_id"] == "commercial-luxury-product"

    response = client.post(
        "/api/visual/compile",
        json={
            "request": "Create an Earth Angel perfume hero image",
            "style_id": "commercial-luxury-product",
            "constraints": ["champagne-inspired setting"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "premium commercial product photography" in body["prompt"]
    assert "champagne-inspired setting" in body["prompt"]
    assert "warped packaging" in body["negative_prompt"]


def test_catalog_load_extends_registry(monkeypatch) -> None:
    reset_registry()
    imported = (
        VisualStyle(
            style_id="awesome-gpt-image-2:test-template",
            name="Test Template",
            category="Test",
            prompt_fragments=("upstream guidance",),
            tags=frozenset({"upstream"}),
            source="github:test@pinned",
        ),
    )
    monkeypatch.setattr(visual_router, "fetch_and_normalize", lambda: imported)
    client = make_client()
    loaded = client.post("/api/visual/catalog/load")
    assert loaded.status_code == 200
    assert loaded.json()["imported_styles"] == 1

    search = client.get("/api/visual/styles", params={"q": "upstream"})
    assert search.status_code == 200
    assert search.json()["items"][0]["style_id"] == "awesome-gpt-image-2:test-template"


def test_unknown_style_returns_404() -> None:
    reset_registry()
    response = make_client().post(
        "/api/visual/compile",
        json={"request": "Generate a visual", "style_id": "missing-style"},
    )
    assert response.status_code == 404
