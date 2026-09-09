from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.config import Settings, get_settings
from backend.app.middleware.auth import get_current_user_id
from backend.app.routers.market import router


def _app(settings: Settings) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_current_user_id] = lambda: "test-user"
    return TestClient(app)


def test_provider_status_never_exposes_secret():
    secret = "secret-messari-key"
    client = _app(Settings(messari_api_key=secret))

    response = client.get("/api/market/providers/status")

    assert response.status_code == 200
    assert response.json()["messari"]["configured"] is True
    assert secret not in response.text


def test_missing_messari_key_returns_controlled_503():
    client = _app(Settings(messari_api_key=""))

    response = client.get("/api/market/assets/bitcoin/metrics")

    assert response.status_code == 503
    assert response.json() == {"detail": "Market data provider is not configured"}


def test_settings_use_server_side_messari_names(monkeypatch):
    monkeypatch.setenv("MESSARI_API_KEY", "server-only")
    monkeypatch.setenv("MESSARI_API_BASE_URL", "https://api.messari.io")

    settings = Settings()

    assert settings.messari_api_key == "server-only"
    assert settings.messari_api_base_url == "https://api.messari.io"
