"""Regression tests for the Operator Command Center admin bypass guard."""

from __future__ import annotations

import importlib

import pytest


@pytest.fixture
def admin_module(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("ALLOW_DEV_ADMIN_BYPASS", raising=False)

    from backend.app.routers import admin

    yield admin

    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("ALLOW_DEV_ADMIN_BYPASS", raising=False)
    importlib.reload(admin)


def test_admin_bypass_is_disabled_in_production(monkeypatch, admin_module):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ALLOW_DEV_ADMIN_BYPASS", "true")

    reloaded = importlib.reload(admin_module)

    assert reloaded._DEV_BYPASS_REQUESTED is True
    assert reloaded._DEV_BYPASS is False


def test_admin_bypass_is_disabled_for_prod_alias(monkeypatch, admin_module):
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("ALLOW_DEV_ADMIN_BYPASS", "true")

    reloaded = importlib.reload(admin_module)

    assert reloaded._DEV_BYPASS is False


def test_admin_bypass_can_be_enabled_only_outside_production(monkeypatch, admin_module):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("ALLOW_DEV_ADMIN_BYPASS", "true")

    reloaded = importlib.reload(admin_module)

    assert reloaded._DEV_BYPASS is True
