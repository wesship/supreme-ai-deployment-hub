"""In-process HTTP smoke checks for the AI Films public API surface."""
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)
response = client.get("/api/ai-films/providers/health")
if response.status_code != 200:
    raise SystemExit(f"Provider health route failed: {response.status_code} {response.text}")

catalog = client.get("/api/ai-films/vfx/makebigfilms/catalog")
if catalog.status_code != 200:
    raise SystemExit(f"MakeBIGFILMS catalog route failed: {catalog.status_code} {catalog.text}")
if catalog.json().get("collection_count") != 32:
    raise SystemExit(f"Unexpected MakeBIGFILMS catalog payload: {catalog.text}")

resolved = client.post(
    "/api/ai-films/vfx/makebigfilms/resolve",
    json={
        "scene_description": "A dimensional portal opens over the city with lightning and debris.",
        "camera_direction": "front right",
    },
)
if resolved.status_code != 200:
    raise SystemExit(f"MakeBIGFILMS resolve route failed: {resolved.status_code} {resolved.text}")
if not resolved.json().get("candidates"):
    raise SystemExit(f"MakeBIGFILMS resolve returned no candidates: {resolved.text}")

for path in ("/api/ai-films/openmontage/dispatch", "/api/ai-films/commerce/campaigns/render"):
    response = client.post(path, json={})
    if response.status_code not in {401, 422}:
        raise SystemExit(f"Expected authorization or validation response for {path}, got {response.status_code}: {response.text}")

print("AI Films HTTP routes passed")
