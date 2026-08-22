from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CANONICAL_APP = ROOT / "backend" / "main.py"
RAILWAY_APP = ROOT / "backend" / "railway_app.py"


def test_canonical_application_mounts_hermes_control_plane_routes() -> None:
    text = CANONICAL_APP.read_text(encoding="utf-8")

    assert "from backend.hermes.router import router as hermes_task_router" in text
    assert "from backend.hermes.recency_router import router as hermes_recency_router" in text
    assert "app.include_router(hermes_task_router)" in text
    assert "app.include_router(hermes_recency_router)" in text


def test_railway_deployment_diagnostics_report_hermes_route_readiness() -> None:
    text = RAILWAY_APP.read_text(encoding="utf-8")

    assert '"hermes_tasks": "/api/hermes/tasks" in paths' in text
    assert '"hermes_recency": "/api/hermes/recency/status" in paths' in text
