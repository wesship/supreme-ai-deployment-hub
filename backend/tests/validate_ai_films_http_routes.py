"""In-process HTTP smoke checks for the AI Films public API surface."""
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)
response = client.get("/api/ai-films/providers/health")
if response.status_code != 200:
    raise SystemExit(f"Provider health route failed: {response.status_code} {response.text}")

for path in ("/api/ai-films/openmontage/dispatch", "/api/ai-films/commerce/campaigns/render"):
    response = client.post(path, json={})
    if response.status_code not in {401, 422}:
        raise SystemExit(f"Expected authorization or validation response for {path}, got {response.status_code}: {response.text}")

print("AI Films HTTP routes passed")
