from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = (ROOT / "backend/client_ai/ingestion_router.py").read_text(encoding="utf-8")
MAIN = (ROOT / "backend/main.py").read_text(encoding="utf-8")
MIGRATION = (ROOT / "supabase/migrations/20260907004500_client_ai_ingestion_tracking.sql").read_text(encoding="utf-8")


def test_ingestion_router_registered():
    assert 'backend.client_ai.ingestion_router' in MAIN
    assert '/profiles/{profile_id}/sources/{source_id}/ingestion' in ROUTER


def test_bridge_uses_canonical_dkos_stages():
    for stage in (
        'security_scan',
        'file_classification',
        'ocr',
        'docling',
        'markitdown',
        'markdown_cleanup',
        'metadata_extraction',
        'knowledge_graph',
        'semantic_chunking',
        'embeddings',
        'pinecone_storage',
        'hermes_memory',
    ):
        assert stage in ROUTER


def test_bridge_enforces_owner_and_training_consent():
    assert 'user_id": f"eq.{user_id}' in ROUTER
    assert 'authorized_for_ai_training' in ROUTER
    assert 'Source consent has been revoked' in ROUTER


def test_bridge_dispatches_dkos_task_with_tenant_scope():
    assert 'task_type="client_ai_dkos_ingestion"' in ROUTER
    assert 'client-ai-ingestion-bridge' in ROUTER
    assert 'tenant_id' in ROUTER
    assert 'contract": "dkos-ingestion-v1"' in ROUTER


def test_ingestion_tracking_is_additive_and_indexed():
    assert 'add column if not exists ingestion_run_id uuid' in MIGRATION
    assert 'add column if not exists hermes_task_id uuid' in MIGRATION
    assert 'add column if not exists current_stage text' in MIGRATION
    assert 'client_ai_sources_ingestion_run_idx' in MIGRATION
