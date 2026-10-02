from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def _routes() -> set[str]:
    app = _read("src/App.tsx")
    return set(re.findall(r'<Route\s+path="([^"]+)"', app))


def _destinations(path: str) -> set[str]:
    source = _read(path)
    values: set[str] = set()
    for pattern in (
        r'\bto="([^"]+)"',
        r'\bhref="([^"]+)"',
        r"\bto:\s*'([^']+)'",
        r"\broute:\s*'([^']+)'",
    ):
        values.update(re.findall(pattern, source))
    return {value for value in values if value.startswith("/")}


def _route_part(destination: str) -> str:
    return destination.split("?", 1)[0].split("#", 1)[0] or "/"


def test_public_and_onboarding_destinations_resolve():
    routes = _routes()
    destinations = set()
    for path in (
        "src/components/index/D3vonnHeroBanner.tsx",
        "src/components/index/BelowFoldSections.tsx",
        "src/pages/LaunchApp.tsx",
    ):
        destinations.update(_destinations(path))

    unresolved = sorted(
        destination
        for destination in destinations
        if _route_part(destination) not in routes
        and destination not in {"/#platform"}
    )
    assert unresolved == []


def test_approval_center_is_admin_guarded():
    app = _read("src/App.tsx")
    assert '<Route path="/approvals" element={<AdminRoute><ApprovalCenter /></AdminRoute>} />' in app
    approval = _read("src/pages/ApprovalCenter.tsx")
    assert "/api/admin/approvals?status=pending" in approval
    assert "decision=approved" not in approval  # decisions are selected at runtime, not hard-coded bypasses


def test_global_hermes_command_uses_authenticated_command_boundary():
    shell = _read("src/components/app/AppShell.tsx")
    client = _read("src/features/knowledge-graph/lib/hermesCommand.ts")
    assert "Ask or instruct Hermes" in shell
    assert "sendHermesBrowserCommand" in shell
    assert "/api/voice/hermes/command" in client
    assert "Authorization" in client


def test_runtime_identity_contract_is_registered_and_preview_safe():
    registry = _read("backend/app/routers/__init__.py")
    router = _read("backend/app/routers/runtime_identity.py")
    hook = _read("src/hooks/useRuntimeIdentity.ts")
    assert "runtime_identity_router" in registry
    assert 'router = APIRouter(prefix="/runtime"' in router
    assert '@router.get("/identity")' in router
    assert "127.0.0.1" in hook
    assert "localhost" in hook
