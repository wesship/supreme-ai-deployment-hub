# Register the Open Source Integration Router

Add this block in `backend/main.py` near the other API router registrations, before the `/health` routes:

```python
try:
    from backend.opensource_integrations.router import router as opensource_integrations_router  # type: ignore

    app.include_router(opensource_integrations_router)
    logger.info("Open Source Integration Layer router registered at /api/opensource/*")
except ImportError as _opensource_integrations_err:
    logger.warning(
        "backend.opensource_integrations.router not found — skipping Open Source Integration Layer. (%s)",
        _opensource_integrations_err,
    )
```
