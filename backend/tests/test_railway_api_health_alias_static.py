from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAILWAY_APP = ROOT / "backend" / "railway_app.py"


def test_railway_exposes_api_health_compatibility_route():
    text = RAILWAY_APP.read_text(encoding="utf-8")

    assert '@app.get("/api/health", tags=["ops"])' in text
    assert 'return {"status": "ok", "version": app.version}' in text


def test_deployment_diagnostics_report_api_health_route():
    text = RAILWAY_APP.read_text(encoding="utf-8")

    assert '"api_health": "/api/health" in paths' in text
    assert 'DEPLOYMENT_REVISION = "railway-api-health-alias-2026-07-29"' in text
