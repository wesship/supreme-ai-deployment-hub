"""Attach the governed Custom Lists routes to the canonical Release 1 router."""
from .primetime_custom_lists import router as custom_lists_router
from .primetime_release1 import router as release1_router

release1_router.include_router(custom_lists_router)
