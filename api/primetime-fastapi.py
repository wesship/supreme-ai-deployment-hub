from fastapi import FastAPI
from datetime import datetime, timezone

app = FastAPI(title="PRIMETIME DEVONN Staging API", version="0.29.0")

@app.get("/")
def root():
    return {
        "ok": True,
        "service": "primetime-fastapi-staging",
        "environment": "staging",
        "release": "phase29-application-staging",
    }

@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "primetime-fastapi-staging",
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
