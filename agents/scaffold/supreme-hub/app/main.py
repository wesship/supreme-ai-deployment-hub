from fastapi import FastAPI
from app.api import deploy, health

app = FastAPI(title="Supreme Deployment Hub")

app.include_router(health.router, prefix="/api/v1")
app.include_router(deploy.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"status": "Supreme Hub running"}
