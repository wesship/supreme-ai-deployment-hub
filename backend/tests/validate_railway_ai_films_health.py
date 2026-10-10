"""Verify the Railway health payload resolves the production AI Films routes."""
from fastapi.testclient import TestClient

from backend.railway_app import app

client = TestClient(app)
response = client.get("/health/deployment")
if response.status_code != 200:
    raise SystemExit(f"Deployment health failed: {response.status_code} {response.text}")
payload = response.json()
routers = payload.get("routers") or {}
required = ("ai_films_director", "ai_films_commerce_render", "ai_films_openmontage")
missing = [name for name in required if routers.get(name) is not True]
if missing:
    raise SystemExit(f"Railway AI Films route flags failed: {missing}; payload={payload}")
print("Railway AI Films deployment health passed")
