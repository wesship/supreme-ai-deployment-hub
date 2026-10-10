import asyncio

from backend.ai_films.drive_connector import _list_active_google_drive_connections


def test_lists_only_active_google_drive_connections():
    class FakeClient:
        async def _request(self, method, path, *, payload=None):
            assert method == "GET"
            assert path == "/connections?page=1&page_limit=50"
            return {
                "data": [
                    {"_id": "active", "provider": "google_drive", "status": "active"},
                    {"_id": "expired", "provider": "google_drive", "status": "expired"},
                    {"_id": "other", "provider": "dropbox", "status": "active"},
                ]
            }

    result = asyncio.run(_list_active_google_drive_connections(FakeClient()))
    assert [row["_id"] for row in result] == ["active"]
