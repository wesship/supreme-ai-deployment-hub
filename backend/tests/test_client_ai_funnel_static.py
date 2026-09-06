from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_client_ai_frontend_is_bootable_and_uses_backend_api():
    main = (ROOT / "src/main.tsx").read_text()
    page = (ROOT / "src/pages/ClientAI.tsx").read_text()

    assert "isClientAIPath" in main
    assert "import('./pages/ClientAI.tsx')" in main
    assert "VITE_API_URL" in page
    assert "/api/client-ai/leads" in page
    assert "consent_to_contact" in page


def test_client_ai_backend_registers_router_and_dispatches_hermes():
    main = (ROOT / "backend/main.py").read_text()
    router = (ROOT / "backend/client_ai/router.py").read_text()

    assert 'backend.client_ai.router' in main
    assert 'APIRouter(prefix="/api/client-ai"' in router
    assert 'task_type="client_ai_lead_qualification"' in router
    assert 'agent_name="hermes"' in router
    assert 'correlation_id=correlation_id' in router
    assert 'website: str' in router


def test_client_ai_schema_is_backend_only_and_tenant_ready():
    migration = (ROOT / "supabase/migrations/20260906143000_client_ai_funnel.sql").read_text()

    assert "create table if not exists public.client_ai_leads" in migration
    assert "create table if not exists public.client_ai_profiles" in migration
    assert "create table if not exists public.client_ai_sources" in migration
    assert "client_key text not null" in migration
    assert "enable row level security" in migration
    assert "revoke all on table public.client_ai_leads from anon, authenticated" in migration
