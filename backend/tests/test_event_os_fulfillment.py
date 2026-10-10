import asyncio

from backend.event_os import fulfillment_worker as worker


ORDER_ID = "c24c8194-10f8-41a4-9248-3fbc48ec23c0"
ITEM_ID = "f24c8194-10f8-41a4-9248-3fbc48ec23c0"
WORKSPACE_ID = "b7c0ccda-88d3-48cf-ab91-811fd73a3d79"
EVENT_ID = "d25e523c-5829-4508-aefd-c61794967371"
TICKET_TYPE_ID = "a24c8194-10f8-41a4-9248-3fbc48ec23c0"
PRODUCT_ID = "aa4c8194-10f8-41a4-9248-3fbc48ec23c0"
SECRET = "x" * 48


def test_qr_token_roundtrip_and_tamper_rejection():
    env = {"EVENT_OS_TICKET_SIGNING_SECRET": SECRET}
    ticket_id = "11111111-2222-3333-4444-555555555555"
    token = worker.build_qr_token(ticket_id, env)

    assert worker.verify_qr_token(token, env) == ticket_id
    assert worker.verify_qr_token(token + "0", env) is None
    assert worker.qr_token_hash(token) != token


class FakeDB:
    def __init__(self):
        self.tables = {
            "orders": [{
                "id": ORDER_ID,
                "workspace_id": WORKSPACE_ID,
                "event_id": EVENT_ID,
                "purchaser_email": "fan@example.com",
                "purchaser_user_id": None,
                "status": "paid",
            }],
            "order_items": [{
                "id": ITEM_ID,
                "order_id": ORDER_ID,
                "product_id": PRODUCT_ID,
                "item_type": "product",
            }],
            "ticket_types": [{
                "id": TICKET_TYPE_ID,
                "event_id": EVENT_ID,
                "name": "VIP",
            }],
            "tickets": [],
            "products": [{
                "id": PRODUCT_ID,
                "name": "HNF Mixtape",
                "fulfillment_mode": "download",
                "metadata": {
                    "entitlement_key": "hnf:mixtape:release-001",
                    "asset_path": "mixtapes/release-001.zip",
                },
            }],
            "entitlements": [],
            "fulfillment_jobs": [],
        }

    async def _request(self, method, table, *, params=None, payload=None, representation=False):
        params = dict(params or {})
        rows = self.tables.setdefault(table, [])

        if method == "GET":
            result = list(rows)
            for key, value in params.items():
                if key in {"select", "order", "limit", "available_at"}:
                    continue
                if value.startswith("eq."):
                    target = value[3:]
                    result = [r for r in result if str(r.get(key)) == target]
            if "limit" in params:
                result = result[: int(params["limit"])]
            return [dict(r) for r in result]

        if method == "POST":
            record = dict(payload or {})
            record.setdefault("id", f"generated-{table}-{len(rows)+1}")
            rows.append(record)
            return [dict(record)] if representation else []

        if method == "PATCH":
            updated = []
            for row in rows:
                matches = True
                for key, value in params.items():
                    if value.startswith("eq.") and str(row.get(key)) != value[3:]:
                        matches = False
                if matches:
                    row.update(dict(payload or {}))
                    updated.append(dict(row))
            return updated if representation else []

        raise AssertionError((method, table))


def test_issue_ticket_job_is_idempotent(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(worker.secrets, "token_hex", lambda n: "1" * (n * 2))
    job = {
        "id": "job-1",
        "workspace_id": WORKSPACE_ID,
        "order_id": ORDER_ID,
        "order_item_id": ITEM_ID,
        "job_type": "issue_ticket",
        "payload": {"ticket_type_id": TICKET_TYPE_ID, "quantity": 1},
    }
    env = {"EVENT_OS_TICKET_SIGNING_SECRET": SECRET}

    first = asyncio.run(worker.process_fulfillment_job(job, db, env))
    second = asyncio.run(worker.process_fulfillment_job(job, db, env))

    assert len(db.tables["tickets"]) == 1
    assert len(first["tickets"]) == 1
    assert len(second["tickets"]) == 1
    assert db.tables["tickets"][0]["qr_token_hash"]
    assert "qr_token" not in db.tables["tickets"][0]


def test_grant_entitlement_job_is_idempotent():
    db = FakeDB()
    job = {
        "id": "job-2",
        "workspace_id": WORKSPACE_ID,
        "order_id": ORDER_ID,
        "order_item_id": ITEM_ID,
        "job_type": "grant_entitlement",
        "payload": {"product_id": PRODUCT_ID, "quantity": 1},
    }

    first = asyncio.run(worker.process_fulfillment_job(job, db, {}))
    second = asyncio.run(worker.process_fulfillment_job(job, db, {}))

    assert len(db.tables["entitlements"]) == 1
    assert first["entitlement"]["entitlement_key"] == "hnf:mixtape:release-001"
    assert second["entitlement"]["entitlement_key"] == "hnf:mixtape:release-001"
