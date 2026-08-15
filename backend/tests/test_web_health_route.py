import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_vercel_health_route_precedes_spa_fallback():
    config = json.loads((ROOT / "vercel.json").read_text())
    rewrites = config["rewrites"]
    health_index = next(i for i, item in enumerate(rewrites) if item.get("source") == "/health")
    fallback_index = next(i for i, item in enumerate(rewrites) if item.get("source") == "/(.*)")
    assert health_index < fallback_index
    assert rewrites[health_index]["destination"] == "/health.json"


def test_health_payload_is_machine_readable():
    payload = json.loads((ROOT / "public" / "health.json").read_text())
    assert payload == {
        "ok": True,
        "service": "d3vonn-web",
        "environment": "production",
        "status": "healthy",
    }
