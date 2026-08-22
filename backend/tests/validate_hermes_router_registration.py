"""In-process smoke check for the protected Hermes route surface."""
from pathlib import Path
import sys

from fastapi import FastAPI

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.hermes.recency_router import router as hermes_recency_router
from backend.hermes.router import router as hermes_task_router


app = FastAPI()
app.include_router(hermes_task_router)
app.include_router(hermes_recency_router)
paths = set(app.openapi()["paths"])
required_paths = {
    "/api/hermes/tasks",
    "/api/hermes/tasks/agents",
    "/api/hermes/tasks/states",
    "/api/hermes/tasks/{task_id}",
    "/api/hermes/recency/acknowledge",
    "/api/hermes/recency/status",
}
missing = sorted(required_paths - paths)
if missing:
    raise SystemExit(f"Hermes route registration missing: {', '.join(missing)}")

print("Hermes protected route registration: OK")
