from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.main import app


def test_readiness_ready_when_dependencies_reachable():
    with patch("backend.main._supabase_status", new=AsyncMock(return_value="reachable")), patch("backend.main._redis_status", return_value="reachable"):
        response = TestClient(app).get("/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["services"]["supabase"] == "reachable"


def test_readiness_503_when_supabase_unreachable():
    with patch("backend.main._supabase_status", new=AsyncMock(return_value="unreachable")), patch("backend.main._redis_status", return_value="reachable"):
        response = TestClient(app).get("/health/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"


def test_readiness_503_when_supabase_not_configured():
    with patch("backend.main._supabase_status", new=AsyncMock(return_value="not_configured")), patch("backend.main._redis_status", return_value="reachable"):
        response = TestClient(app).get("/health/ready")
    assert response.status_code == 503
    assert response.json()["services"]["supabase"] == "not_configured"


def test_readiness_503_when_redis_unreachable():
    with patch("backend.main._supabase_status", new=AsyncMock(return_value="reachable")), patch("backend.main._redis_status", return_value="unreachable"):
        response = TestClient(app).get("/health/ready")
    assert response.status_code == 503
    assert response.json()["services"]["redis"] == "unreachable"


def test_liveness_remains_200_when_dependencies_fail():
    with patch("backend.main._supabase_status", new=AsyncMock(return_value="unreachable")), patch("backend.main._redis_status", return_value="unreachable"):
        response = TestClient(app).get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_remains_200_when_dependencies_fail():
    with patch("backend.main._supabase_status", new=AsyncMock(return_value="unreachable")), patch("backend.main._redis_status", return_value="unreachable"):
        response = TestClient(app).get("/health")
    assert response.status_code == 200


def test_rum_cors_allows_d3vonn_production_origin():
    client = TestClient(app)
    response = client.options(
        "/api/assurance/public/rum",
        headers={
            "Origin": "https://d3vonn.io",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://d3vonn.io"


def test_rum_cors_does_not_allow_arbitrary_origin():
    client = TestClient(app)
    response = client.options(
        "/api/assurance/public/rum",
        headers={
            "Origin": "https://example.invalid",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert "access-control-allow-origin" not in response.headers


def test_rum_metric_accepts_mile_high_golden_elevation_route():
    client = TestClient(app)
    response = client.post(
        "/api/assurance/public/rum",
        json={
            "name": "LCP",
            "value": 42,
            "route": "/mile-high-golden-elevation",
            "navigation_type": "navigate",
            "deployment": "production",
        },
    )
    assert response.status_code == 202
    assert response.json() == {"accepted": True}
