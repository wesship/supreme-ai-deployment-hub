"""The release canary must exercise user authentication, not bypass the API."""
import importlib.util
from pathlib import Path
from unittest.mock import Mock

import pytest


@pytest.fixture
def canary(monkeypatch):
    for name, value in {"SUPABASE_URL": "https://storage.invalid",
                        "SUPABASE_SERVICE_ROLE_KEY": "test-storage-only",
                        "CERTIFIED_SHA": "a" * 40,
                        "E2E_TEST_EMAIL": "operator@example.invalid",
                        "E2E_TEST_PASSWORD": "test-password"}.items():
        monkeypatch.setenv(name, value)
    path = Path(__file__).parents[2] / "scripts/hermes/production_lifecycle_canary.py"
    spec = importlib.util.spec_from_file_location("production_canary", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_operator_authenticates_and_api_receives_only_user_jwt(canary, monkeypatch):
    request = Mock(side_effect=[{"access_token": "user-jwt"}, {"tasks": []}])
    monkeypatch.setattr(canary, "_json_request", request)
    canary.authenticate_operator()
    assert request.call_args_list[0].kwargs["payload"]["email"] == "operator@example.invalid"
    assert request.call_args_list[1].kwargs["headers"] == {"Authorization": "Bearer user-jwt"}


def test_missing_auth_token_stops_before_hermes_api(canary, monkeypatch):
    request = Mock(return_value={})
    monkeypatch.setattr(canary, "_json_request", request)
    with pytest.raises(RuntimeError, match="no access token"):
        canary.authenticate_operator()
    assert request.call_count == 1


def test_task_creation_uses_authenticated_api_and_validates_response(canary, monkeypatch):
    canary._API_HEADERS["Authorization"] = "Bearer user-jwt"
    request = Mock(return_value={"task": {"id": "task-1"}})
    monkeypatch.setattr(canary, "_json_request", request)
    assert canary.create_canary_task()["id"] == "task-1"
    assert request.call_args.args[0].endswith("/api/hermes/tasks")
    assert request.call_args.kwargs["headers"] == {"Authorization": "Bearer user-jwt"}
    assert "status" not in request.call_args.kwargs["payload"]
    request.return_value = {"task": {}}
    with pytest.raises(RuntimeError, match="created task"):
        canary.create_canary_task()


def test_worker_from_another_commit_cannot_certify_release(canary, monkeypatch):
    from datetime import datetime, timezone
    monkeypatch.setattr(canary, "_table_get", Mock(return_value=[{
        "worker_id": "old-worker", "last_heartbeat_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {"commit_sha": "b" * 40},
    }]))
    with pytest.raises(RuntimeError, match="No healthy/busy Hermes worker"):
        canary.require_fresh_worker()
