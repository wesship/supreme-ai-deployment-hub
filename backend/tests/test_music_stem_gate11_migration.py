"""Gate 11 migration contract checks; do not imply database integration tests."""
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "supabase/migrations/20261016180000_music_stem_gate11.sql"

def test_music_storage_is_private_and_owner_scoped():
    sql = MIGRATION.read_text()
    assert "'music-stem-private',false" in sql
    assert "storage.foldername(name))[1] = (SELECT auth.uid())::text" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "music_jobs_owner_read" in sql
    assert "music_artifacts_owner_read" in sql

def test_client_cannot_mutate_job_rows_using_table_grants():
    sql = MIGRATION.read_text()
    assert "REVOKE ALL ON public.music_stem_jobs FROM anon, authenticated" in sql
    assert "GRANT SELECT ON public.music_stem_jobs TO authenticated" in sql
    assert "GRANT INSERT" not in sql
    assert "GRANT UPDATE" not in sql
    assert "GRANT DELETE" not in sql

def test_idempotency_and_hash_constraints_are_present():
    sql = MIGRATION.read_text()
    assert "UNIQUE (owner_id,idempotency_key)" in sql
    assert "source_sha256 ~ '^[a-f0-9]{64}$'" in sql
