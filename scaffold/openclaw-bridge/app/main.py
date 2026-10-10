from fastapi import FastAPI
from app.api import execute, health

app = FastAPI(title="OpenClaw Bridge")

app.include_router(health.router, prefix="/api/v1")
app.include_router(execute.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"status": "OpenClaw Bridge running"}
