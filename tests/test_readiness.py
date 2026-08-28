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
    assert response.json()["status"] == "ok"
