from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTER_REGISTRY = ROOT / "backend" / "app" / "routers" / "__init__.py"
RAILWAY_APP = ROOT / "backend" / "railway_app.py"


def test_canonical_router_exposes_api_health_compatibility_route():
    text = ROUTER_REGISTRY.read_text(encoding="utf-8")

    assert '@proxy_router.get("/health", tags=["ops"])' in text
    assert 'return {"status": "ok", "version": request.app.version}' in text


def test_deployment_diagnostics_report_api_health_route_and_environment():
    text = RAILWAY_APP.read_text(encoding="utf-8")

    assert 'os.getenv("RAILWAY_ENVIRONMENT_NAME", "").strip()' in text
    assert 'os.environ["ENVIRONMENT"] = railway_environment' in text
    assert 'app = import_module("backend.main").app' in text
    assert '"api_health": "/api/health" in paths' in text
    assert '"railway_environment": os.getenv("RAILWAY_ENVIRONMENT_NAME", "unknown")' in text
    assert '"railway_deployment_id": os.getenv("RAILWAY_DEPLOYMENT_ID")' in text
    assert 'DEPLOYMENT_REVISION = "railway-ai-films-openmontage-production-2026-08-18"' in text
