from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_client_ai_onboarding_is_authenticated_and_owner_scoped():
    auth = (ROOT / "backend/client_ai/auth.py").read_text()
    router = (ROOT / "backend/client_ai/onboarding_router.py").read_text()
    assert "_get_authenticated_user" in auth
    assert "user_id" in router
    assert "eq.{principal.user_id}" in router
    assert "Lead does not belong to this user" in router


def test_client_ai_source_ingestion_requires_explicit_consent():
    router = (ROOT / "backend/client_ai/onboarding_router.py").read_text()
    assert "consent_confirmed" in router
    assert "requires explicit consent confirmation" in router
    assert 'task_type="client_ai_source_ingestion"' in router
    assert '"profile_state": "training"' in router


def test_client_ai_workspace_uses_supabase_session_and_backend_api():
    workspace = (ROOT / "src/pages/ClientAIWorkspace.tsx").read_text()
    main = (ROOT / "src/main.tsx").read_text()
    assert "supabase.auth.getSession()" in workspace
    assert "Authorization: `Bearer ${token}`" in workspace
    assert "/api/client-ai/profiles/initialize" in workspace
    assert "consent_confirmed: consent" in workspace
    assert "ClientAIWorkspace.tsx" in main
    assert "client-ai\\/(?:onboarding|workspace)" in main


def test_client_ai_onboarding_router_is_registered():
    main = (ROOT / "backend/main.py").read_text()
    assert '("backend.client_ai.onboarding_router", "router", None)' in main
