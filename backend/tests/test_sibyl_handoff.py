"""Ingress contract and storage-boundary tests; no real users or provider calls."""
import asyncio
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI

from backend.hermes import sibyl_handoff as ingress
from backend.hermes.infrastructure import HermesInfrastructureConfig, SupabaseRestClient

TOKEN = "test-only-sibyl-token-" + "x" * 40
ACTOR = "a" * 24
PATH = "/api/hermes/sibyl/v1/drafts"


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("HERMES_SIBYL_SERVICE_TOKEN", TOKEN)
    monkeypatch.setenv("HERMES_SIBYL_ACTOR_REF", ACTOR)
    rows = {}
    calls = []
    real_client = httpx.AsyncClient

    async def transport(request):
        # All outbound traffic MUST be storage, never a model or worker.
        assert request.url.host == "storage.invalid"
        assert request.url.path == "/rest/v1/" + ingress.TABLE
        calls.append(request)
        if request.method == "POST":
            import json
            data = json.loads(request.content)
            key = (data["actor_ref"], data["idempotency_key"])
            if key in rows:
                return httpx.Response(409, json={"code": "23505"})
            row = {"id": str(uuid4()), **data}
            rows[key] = row
            return httpx.Response(201, json=[row])
        key = (request.url.params["actor_ref"][3:], request.url.params["idempotency_key"][3:])
        return httpx.Response(200, json=[rows[key]] if key in rows else [])

    def storage_client(*args, **kwargs):
        return real_client(transport=httpx.MockTransport(transport), **kwargs)

    monkeypatch.setattr(ingress, "_store", SupabaseRestClient(HermesInfrastructureConfig(
        supabase_url="https://storage.invalid", service_role_key="storage-test-only")))
    monkeypatch.setattr(httpx, "AsyncClient", storage_client)
    app = FastAPI()
    app.include_router(ingress.router)
    client = real_client(transport=httpx.ASGITransport(app=app), base_url="http://test")
    return client, rows, calls


def payload():
    key = str(uuid4())
    return {"title": "Synthetic acceptance check", "description": "Draft a plan; perform no actions.",
            "metadata": {"source": "astral-sibyl-echo", "intent": "planning_only", "execution_allowed": False,
                         "synthetic": True, "actor_ref": ACTOR, "idempotency_key": key}}


def headers(body):
    return {"Authorization": "Bearer " + TOKEN, "Idempotency-Key": body["metadata"]["idempotency_key"]}


@pytest.mark.asyncio
async def test_create_retry_conflict_and_no_dispatch(setup):
    client, rows, calls = setup
    body = payload()
    first = await client.post(PATH, json=body, headers=headers(body))
    assert first.status_code == 201
    result = first.json()
    assert result["status"] == "draft" and result["execution_allowed"] is False
    assert result["contract"] == "sibyl-planning-v1" and result["duplicate"] is False
    retry = await client.post(PATH, json=body, headers=headers(body))
    assert retry.json()["id"] == result["id"] and retry.json()["duplicate"] is True
    body["description"] = "Changed content"
    changed = await client.post(PATH, json=body, headers=headers(body))
    assert changed.status_code == 409
    assert len(rows) == 1
    assert all("hermes_tasks" not in str(r.url) for r in calls)
    assert "description" not in result and "summary" not in result


@pytest.mark.asyncio
async def test_concurrent_retries_return_one_receipt(setup):
    client, rows, _ = setup
    body = payload()
    replies = await asyncio.gather(*(client.post(PATH, json=body, headers=headers(body)) for _ in range(8)))
    assert all(r.status_code == 201 for r in replies)
    assert len({r.json()["id"] for r in replies}) == 1 and len(rows) == 1
    assert sum(not r.json()["duplicate"] for r in replies) == 1


@pytest.mark.parametrize("token", ["", "Bearer wrong", "Bearer fake.operator.jwt", "Bearer \u00e9", "Basic anything"])
@pytest.mark.asyncio
async def test_bad_auth_cannot_write(setup, token):
    client, rows, calls = setup
    body = payload()
    h = headers(body)
    # Non-ASCII HTTP values are bytes; the dependency must not throw TypeError.
    h["Authorization"] = token.encode("utf8")
    reply = await client.post(PATH, json=body, headers=h)
    assert reply.status_code == 401 and not rows and not calls


@pytest.mark.asyncio
async def test_missing_config_fails_closed(setup, monkeypatch):
    client, _, calls = setup
    monkeypatch.delenv("HERMES_SIBYL_SERVICE_TOKEN")
    body = payload()
    assert (await client.post(PATH, json=body, headers=headers(body))).status_code == 503
    assert not calls


@pytest.mark.parametrize("mutation", [
    lambda b: b["metadata"].update(execution_allowed=True),
    lambda b: b["metadata"].update(execution_allowed="false"),
    lambda b: b["metadata"].update(intent="execute"),
    lambda b: b["metadata"].update(source="hnfportal"),
    lambda b: b.update(task_type="tars.plan"),
    lambda b: b.update(description=" " * 20),
    lambda b: b.update(description="x" * 4001),
    lambda b: b.update(title="x" * 121),
    lambda b: b.update(description="bad\x00text"),
    lambda b: b["metadata"].update(context={"journal": "private"}),
])
@pytest.mark.asyncio
async def test_rejects_execution_private_fields_and_invalid_text(setup, mutation):
    client, rows, calls = setup
    body = payload()
    mutation(body)
    reply = await client.post(PATH, json=body, headers=headers(body))
    assert reply.status_code == 422 and not rows and not calls


@pytest.mark.asyncio
async def test_actor_and_header_binding(setup):
    client, _, calls = setup
    body = payload()
    body["metadata"]["actor_ref"] = "b" * 24
    assert (await client.post(PATH, json=body, headers=headers(body))).status_code == 403
    body = payload()
    h = headers(body)
    h["Idempotency-Key"] = str(uuid4())
    assert (await client.post(PATH, json=body, headers=h)).status_code == 422
    h.pop("Idempotency-Key")
    assert (await client.post(PATH, json=body, headers=h)).status_code == 422
    assert not calls


@pytest.mark.asyncio
async def test_capabilities_scoped_and_no_execute_route(setup):
    client, _, calls = setup
    route = "/api/hermes/sibyl/v1/capabilities"
    assert (await client.get(route)).status_code == 401
    reply = await client.get(route, headers={"Authorization": "Bearer " + TOKEN})
    assert reply.json()["planning_only"] is True
    assert reply.json()["idempotency"] == "actor_and_key_unique"
    assert (await client.post("/api/hermes/sibyl/v1/execute", headers={"Authorization": "Bearer " + TOKEN})).status_code == 404
    assert not calls


@pytest.mark.asyncio
async def test_chunked_size_limit_and_auth_before_parsing(setup):
    client, _, calls = setup
    body = payload()
    async def chunks():
        yield b" " * 9000
        yield b" " * 9000
    reply = await client.post(PATH, content=chunks(), headers=headers(body))
    assert reply.status_code == 413
    reply = await client.post(PATH, content=b"not json")
    assert reply.status_code == 401
    assert not calls


@pytest.mark.parametrize("mode", ["missing", "unavailable", "network", "no_receipt"])
@pytest.mark.asyncio
async def test_storage_failures_never_report_success(setup, monkeypatch, mode):
    client, _, _ = setup
    class BrokenStore:
        configured = mode != "missing"
        async def post(self, *_):
            if mode == "network":
                raise httpx.ConnectError("private upstream detail")
            if mode == "no_receipt":
                return {}
            response = httpx.Response(500, request=httpx.Request("POST", "https://storage.invalid"))
            raise httpx.HTTPStatusError("private upstream detail", request=response.request, response=response)
    monkeypatch.setattr(ingress, "_store", BrokenStore())
    body = payload()
    reply = await client.post(PATH, json=body, headers=headers(body))
    assert reply.status_code == 503 and "private upstream detail" not in reply.text
