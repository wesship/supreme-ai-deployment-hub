"""Pytest import aliases for backend proxy tests.

The proxy modules are imported as both ``app`` (when tests run from the
backend directory) and ``backend.app`` (inside the application modules). Without
this alias layer, FastAPI dependency overrides and unittest patches target a
separate module object and auth falls through to a real 401 response.
"""
from __future__ import annotations

import importlib
import sys

_MODULE_ALIASES = (
    "config",
    "middleware",
    "middleware.auth",
    "middleware.rate_limit",
    "models",
    "models.proxy",
    "routers",
    "routers.admin",
    "routers.chat",
    "routers.rag",
    "routers.tools",
)


def pytest_configure() -> None:
    backend_app = importlib.import_module("backend.app")
    sys.modules["app"] = backend_app

    for module_name in _MODULE_ALIASES:
        backend_name = f"backend.app.{module_name}"
        alias_name = f"app.{module_name}"
        sys.modules[alias_name] = importlib.import_module(backend_name)
