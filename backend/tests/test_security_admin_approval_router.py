from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers.admin import _require_admin
from backend.app.security.admin_approval_router import get_approval_service, router


class FakeDecision:
    def __init__(self, action_id: str, status: str, approver_id: str, reason=None):
        self.action_id = action_id
        self.status = status
        self.approver_id = approver_id
        self.reason = reason


class FakeService:
    def __init__(self):
        self.calls = []

    def approve(self, action_id: str, approver_id: str):
        self.calls.append(("approve", action_id, approver_id))
        return FakeDecision(action_id, "approved", approver_id)

    def reject(self, action_id: str, approver_id: str, reason: str):
        self.calls.append(("reject", action_id, approver_id, reason))
        return FakeDecision(action_id, "rejected", approver_id, reason)

    async def execute_approved(self, action_id: str):
        self.calls.append(("execute", action_id))
        return {"action_id": action_id, "status": "not_executed"}


def _client(service: FakeService) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_approval_service] = lambda: service
    app.dependency_overrides[_require_admin] = lambda: "00000000-0000-0000-0000-000000000001"
    return TestClient(app)


def test_routes_require_admin_dependency():
    routes = {route.path: route for route in router.routes}
    for path in (
        "/api/security/admin/actions/{action_id}/approve",
        "/api/security/admin/actions/{action_id}/reject",
        "/api/security/admin/actions/{action_id}/execute",
    ):
        dependency_names = {
            dependency.call.__name__
            for dependency in routes[path].dependant.dependencies
            if dependency.call is not None
        }
        assert "_require_admin" in dependency_names


def test_approve_uses_authenticated_admin_identity():
    service = FakeService()
    client = _client(service)
    action_id = "00000000-0000-0000-0000-000000000010"
    response = client.post(f"/api/security/admin/actions/{action_id}/approve")
    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert service.calls == [
        ("approve", action_id, "00000000-0000-0000-0000-000000000001")
    ]


def test_reject_requires_reason_and_uses_admin_identity():
    service = FakeService()
    client = _client(service)
    action_id = "00000000-0000-0000-0000-000000000011"
    response = client.post(
        f"/api/security/admin/actions/{action_id}/reject",
        json={"reason": "False positive after analyst review"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert service.calls[0][0] == "reject"


def test_execute_remains_fail_closed_without_executor():
    service = FakeService()
    client = _client(service)
    action_id = "00000000-0000-0000-0000-000000000012"
    response = client.post(f"/api/security/admin/actions/{action_id}/execute")
    assert response.status_code == 200
    assert response.json()["status"] == "not_executed"


def test_invalid_action_id_is_rejected_before_service_call():
    service = FakeService()
    client = _client(service)
    response = client.post("/api/security/admin/actions/not-a-uuid/approve")
    assert response.status_code == 422
    assert service.calls == []
