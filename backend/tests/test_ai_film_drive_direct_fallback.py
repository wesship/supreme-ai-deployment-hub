import asyncio

from backend.ai_films.drive_direct_fallback import _picker_access_token


def test_picker_access_token_uses_active_connection_endpoint():
    class FakeClient:
        async def _request(self, method, path, *, payload=None):
            assert method == "POST"
            assert path == "/connections/conn_123/picker-token"
            return {
                "access_token": "ya29.test-token",
                "expires_in": 3600,
                "scope": "https://www.googleapis.com/auth/drive.readonly",
            }

    token = asyncio.run(_picker_access_token(FakeClient(), "conn_123"))
    assert token == "ya29.test-token"
