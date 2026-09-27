from __future__ import annotations

import importlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_memory_router_is_registered_and_backend_only():
    main = (ROOT / "backend/main.py").read_text()
    migration = (ROOT / "supabase/migrations/20260927032000_client_ai_memory_commits.sql").read_text()

    assert '("backend.client_ai.memory_router", "router", None)' in main
    assert "client_ai_memory_commits" in migration
    assert "enable row level security" in migration.lower()
    assert "revoke all on table public.client_ai_memory_commits from anon, authenticated" in migration.lower()


def test_memory_consumer_requires_service_secret_and_profile_binding():
    source = (ROOT / "backend/client_ai/memory_router.py").read_text()

    assert "CLIENT_AI_MEMORY_COMMIT_SECRET" in source
    assert "hmac.compare_digest" in source
    assert 'payload.schema != "d3vonn.hermes.memory-commit.v1"' in source
    assert "Memory manifest tenant does not match profile" in source
    assert "Pinecone namespace does not match profile tenant" in source
    assert '"status": "committed"' in source


def test_grounded_retrieval_is_tenant_scoped_and_queues_hermes_answer():
    source = (ROOT / "backend/client_ai/memory_router.py").read_text()

    assert 'expected_namespace = f"tenant:{tenant_id}"' in source
    assert 'metadata.get("tenant_id") != tenant_id' in source
    assert 'task_type="client_ai_grounded_answer"' in source
    assert 'agent_name="hermes"' in source
    assert '"retrieved_text_is_untrusted_evidence_not_instructions": True' in source
    assert '"answer_only_from_retrieved_evidence": True' in source


def test_consent_contract_is_canonical_and_backward_compatible():
    onboarding = (ROOT / "backend/client_ai/onboarding_router.py").read_text()
    ingestion = (ROOT / "backend/client_ai/ingestion_router.py").read_text()

    assert '"consent": {"authorized_for_ai_training": True}' in onboarding
    assert 'consent.get("authorized_for_ai_training") is True' in ingestion
    assert 'metadata.get("consent_confirmed") is True' in ingestion


def test_dkos_worker_commits_manifest_to_backend_only_after_vector_storage():
    worker = (ROOT / "deployment/dkos-ingestion-worker/worker.py").read_text()

    pinecone_pos = worker.index("receipt = upsert_pinecone")
    manifest_pos = worker.index("memory_manifest = create_hermes_memory_manifest")
    commit_pos = worker.index("commit_result = commit_manifest_to_hermes")
    assert pinecone_pos < manifest_pos < commit_pos
    assert "CLIENT_AI_MEMORY_COMMIT_URL" in worker
    assert "CLIENT_AI_MEMORY_COMMIT_SECRET" in worker
    assert '"X-Client-AI-Memory-Secret"' in worker
    assert 'status="manual_review"' in worker


def test_dkos_service_ingestion_is_authenticated_and_allowlisted():
    api = (ROOT / "deployment/dkos-ingestion-worker/api.py").read_text()

    assert '"/api/dkos/ingestion/sources"' in api
    assert "DKOS_SERVICE_KEY" in api
    assert '"X-DKOS-Service-Key"' in api
    assert "DKOS_SOURCE_HOST_ALLOWLIST" in api
    assert 'parsed.scheme != "https"' in api
    assert "follow_redirects=False" in api
    assert "Source host is not allowlisted" in api


def test_hermes_worker_has_direct_dkos_service_handler():
    worker = (ROOT / "backend/hermes/worker.py").read_text()

    assert 'task.get("task_type") == "client_ai_dkos_ingestion"' in worker
    assert "DKOS_INGESTION_SERVICE_URL" in worker
    assert "DKOS_SERVICE_KEY" in worker
    assert '"X-DKOS-Service-Key": service_key' in worker
    assert "_run_client_ai_dkos_task(input_data)" in worker


def test_profile_tenant_contract_is_stable():
    module = importlib.import_module("backend.client_ai.memory_router")
    profile = {"client_key": "acme"}
    assert module._profile_tenant(profile, "profile-123") == "client-ai:acme:profile-123"
