import json
from pathlib import Path

from backend.ai_films.picker_router import (
    _expected_drive_entries,
    _selected_ids_for_connection,
    router,
)


ROOT = Path(__file__).resolve().parents[2]


def test_picker_manifest_contains_all_23_unique_drive_masters():
    entries = _expected_drive_entries()
    ids = {entry["source_id"] for entry in entries}
    filenames = {entry["filename"] for entry in entries}

    assert len(entries) == 23
    assert len(ids) == 23
    assert len(filenames) == 23
    assert all(entry["filename"].lower().endswith((".mp4", ".mov", ".m4v")) for entry in entries)


def test_picker_selections_are_scoped_to_the_active_connection():
    expected = {"file-a", "file-b"}
    metadata = {
        "drive_picker_connection_id": "conn-a",
        "drive_picker_selected_ids": ["file-a", "file-b"],
    }

    assert _selected_ids_for_connection(metadata, "conn-a", expected) == expected
    assert _selected_ids_for_connection(metadata, "conn-b", expected) == set()


def test_picker_routes_are_admin_dependency_protected():
    routes = {route.path: route for route in router.routes}
    expected_paths = {
        "/ai-films/admin/drive-picker/session",
        "/ai-films/admin/drive-picker/selection",
        "/ai-films/admin/drive-picker/run",
    }
    assert expected_paths <= set(routes)

    for path in expected_paths:
        dependency_names = {
            dependency.call.__name__
            for dependency in routes[path].dependant.dependencies
            if dependency.call is not None
        }
        assert "_require_admin" in dependency_names


def test_picker_frontend_never_persists_picker_access_token():
    component = (ROOT / "src/features/ai-films/DrivePickerWorkspace.tsx").read_text()
    assert "access_token" in component
    assert "localStorage" not in component
    assert "sessionStorage" not in component
    assert "supabase.from" not in component
    assert "cache: 'no-store'" in component
    assert "/api/ai-films/admin/drive-picker/session" in component
    assert "/api/ai-films/admin/drive-picker/selection" in component
    assert "/api/ai-films/admin/drive-picker/run" in component


def test_vercel_csp_allows_only_required_google_picker_origins():
    config = json.loads((ROOT / "vercel.json").read_text())
    csp = next(
        header["value"]
        for block in config["headers"]
        for header in block["headers"]
        if header["key"] == "Content-Security-Policy"
    )
    assert "script-src" in csp and "https://apis.google.com" in csp
    assert "connect-src" in csp and "https://www.googleapis.com" in csp
    assert "frame-src" in csp and "https://docs.google.com" in csp
    assert "https://drive.google.com" in csp
    assert "https://accounts.google.com" in csp
