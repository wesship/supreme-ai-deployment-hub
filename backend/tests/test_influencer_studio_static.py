from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "backend/main.py"
APP = ROOT / "src/App.tsx"
PAGE = ROOT / "src/pages/InfluencerStudio.tsx"
README = ROOT / "backend/influencer_studio/README.md"


def test_influencer_studio_router_and_private_pilot_ui_are_registered() -> None:
    main = MAIN.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    page = PAGE.read_text(encoding="utf-8")

    assert '("backend.influencer_studio.router", "router", None)' in main
    assert 'import("./pages/InfluencerStudio")' in app
    assert 'path="/influencer-studio"' in app
    assert "<AdminRoute><InfluencerStudio /></AdminRoute>" in app
    assert "READY_TO_PUBLISH" in page
    assert "External publishing stays disabled" in page


def test_documented_api_flow_stops_before_irreversible_publish() -> None:
    readme = README.read_text(encoding="utf-8")
    assert "POST /api/influencer-studio/personas" in readme
    assert "POST /api/influencer-studio/campaigns/{id}/ready" in readme
    assert "External publishing is disabled in this gate." in readme
    assert "does **not** automatically publish" in readme
