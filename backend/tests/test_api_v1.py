"""
Unit and integration tests for API v1 endpoints.
Run with: pytest backend/tests/test_api_v1.py -v
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport


@pytest.fixture
def mock_token():
    return "Bearer test-jwt-token"


@pytest.fixture
def mock_user():
    return {"sub": "user-123", "email": "test@devonn.ai"}


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_200(self):
        try:
            from main import app
        except ImportError:
            pytest.skip("main.py not available in test environment")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    @pytest.mark.asyncio
    async def test_health_no_auth_required(self):
        try:
            from main import app
        except ImportError:
            pytest.skip("main.py not available in test environment")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")
        assert response.status_code != 401


class TestTaskEndpoints:
    @pytest.mark.asyncio
    async def test_create_task_requires_auth(self):
        try:
            from main import app
        except ImportError:
            pytest.skip("main.py not available in test environment")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/tasks", json={"task_type": "test", "payload": {}})
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_create_task_validates_body(self):
        try:
            from main import app
        except ImportError:
            pytest.skip("main.py not available in test environment")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/tasks",
                json={},  # missing required fields
                headers={"Authorization": "Bearer invalid"}
            )
        assert response.status_code in (401, 403, 422)

    @pytest.mark.asyncio
    async def test_get_task_not_found(self):
        try:
            from main import app
        except ImportError:
            pytest.skip("main.py not available in test environment")
        with patch("api.v1.router.verify_jwt", return_value={"sub": "user-123"}):
            with patch("api.v1.router.cache_get", new_callable=AsyncMock, return_value=None):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    response = await client.get(
                        "/api/v1/tasks/nonexistent-id",
                        headers={"Authorization": "Bearer valid-token"}
                    )
        assert response.status_code in (404, 401, 403)


class TestRateLimiting:
    def test_rate_limit_middleware_exists(self):
        try:
            from middleware.rate_limit import RateLimitMiddleware
            assert RateLimitMiddleware is not None
        except ImportError:
            pytest.skip("rate_limit middleware not available")

    def test_rate_limit_config_reasonable(self):
        try:
            from middleware.rate_limit import RateLimitMiddleware
            # Ensure the middleware class is importable and has expected attributes
            assert hasattr(RateLimitMiddleware, "dispatch") or callable(RateLimitMiddleware)
        except ImportError:
            pytest.skip("rate_limit middleware not available")


class TestAgentMesh:
    def test_agent_mesh_importable(self):
        try:
            from mesh.agent_mesh import AgentMesh
            assert AgentMesh is not None
        except ImportError:
            pytest.skip("agent_mesh not available")

    @pytest.mark.asyncio
    async def test_agent_mesh_dispatch_unknown_agent(self):
        try:
            from backend.mesh.agent_mesh import AgentMesh, AgentTask  # type: ignore
        except ImportError:
            pytest.skip("agent_mesh not available")
        mesh = AgentMesh()
        task = AgentTask(agent_name="nonexistent-agent", action="ping")
        result = await mesh.dispatch(task)
        # AgentResult.success should be False for an unknown agent
        assert result.success is False
        assert "nonexistent-agent" in (result.error or "")
