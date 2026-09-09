import pytest

from backend.app.security.approval_execution import ApprovalExecutionService


class Response:
    def __init__(self, data=None):
        self.data = data or []


class FakeTable:
    def __init__(self, store):
        self.store = store
        self.filters = []
        self.payload = None
        self.mode = "select"

    def select(self, *_args):
        self.mode = "select"
        return self

    def update(self, payload):
        self.mode = "update"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def limit(self, _value):
        return self

    def execute(self):
        matches = [r for r in self.store if all(r.get(k) == v for k, v in self.filters)]
        if self.mode == "select":
            return Response(matches)
        for row in matches:
            row.update(self.payload)
        return Response(matches)


class FakeDB:
    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        assert name == "hermes_security_actions"
        return FakeTable(self.rows)


def make_action(status="pending_approval", action_type="block_ip"):
    return {
        "id": "a1",
        "agent_name": "soar_engine",
        "action_type": action_type,
        "status": status,
        "details": {"source": "test"},
    }


def test_approve_requires_human_identity_and_pending_destructive_action():
    row = make_action()
    service = ApprovalExecutionService(FakeDB([row]))

    decision = service.approve("a1", "admin@example.com")

    assert decision.status == "approved"
    assert row["status"] == "approved"
    assert row["details"]["approval"]["approver_id"] == "admin@example.com"


def test_reject_requires_reason_and_records_audit_identity():
    row = make_action()
    service = ApprovalExecutionService(FakeDB([row]))

    decision = service.reject("a1", "security-lead", "Target ownership not verified")

    assert decision.status == "rejected"
    assert row["status"] == "rejected"
    assert row["details"]["approval"]["reason"] == "Target ownership not verified"


@pytest.mark.asyncio
async def test_execution_fails_closed_without_registered_executor():
    row = make_action(status="approved")
    service = ApprovalExecutionService(FakeDB([row]))

    result = await service.execute_approved("a1")

    assert result["status"] == "not_executed"
    assert row["status"] == "approved"


@pytest.mark.asyncio
async def test_registered_executor_result_is_audited():
    row = make_action(status="approved")

    async def executor(action):
        assert action["id"] == "a1"
        return {"status": "success", "provider_ref": "provider-123"}

    service = ApprovalExecutionService(FakeDB([row]), {"block_ip": executor})
    result = await service.execute_approved("a1")

    assert result["status"] == "executed"
    assert row["status"] == "executed"
    assert row["details"]["execution"]["result"]["provider_ref"] == "provider-123"


@pytest.mark.asyncio
async def test_unapproved_action_cannot_execute():
    row = make_action(status="pending_approval")
    service = ApprovalExecutionService(FakeDB([row]), {"block_ip": lambda _a: None})

    with pytest.raises(ValueError, match="approved"):
        await service.execute_approved("a1")


def test_non_destructive_action_cannot_use_containment_approval_path():
    row = make_action(action_type="notify_admin")
    service = ApprovalExecutionService(FakeDB([row]))

    with pytest.raises(ValueError, match="approval-gated"):
        service.approve("a1", "security-lead")
