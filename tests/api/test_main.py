import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "Devonn.ai - Model Control Panel API"
    assert payload["version"] == "2.0.0"
    assert payload["docs"] == "/docs"
    assert payload["health"] == "/health"
    assert payload["endpoints"]["runs"] == "/runs"


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"] == "2.0.0"
    assert isinstance(payload["active_runs"], int)


def test_runs_start_route_is_registered():
    route_paths = {route.path for route in app.routes}
    assert "/runs/start" in route_paths


@pytest.mark.parametrize(
    "invalid_request",
    [
        {"parameters": {}},  # missing job_type
        {"job_type": "test"},  # missing parameters
        {},  # empty request
    ],
)
def test_runs_start_request_validation(invalid_request):
    response = client.post("/runs/start", json=invalid_request)
    assert response.status_code == 422
