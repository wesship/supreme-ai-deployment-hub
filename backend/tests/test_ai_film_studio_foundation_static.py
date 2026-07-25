from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "202607240001_ai_film_studio_foundation.sql"
TAXONOMY = ROOT / "src" / "features" / "ai-films" / "imageTaxonomy.ts"


def test_foundation_migration_exists_and_defines_core_tables() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    required_tables = {
        "ai_film_projects",
        "ai_film_assets",
        "ai_film_entities",
        "ai_film_relationships",
        "ai_film_canon_rules",
        "ai_film_scenes",
        "ai_film_scene_assets",
    }

    for table in required_tables:
        assert f"create table public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql


def test_assets_support_taxonomy_search_and_deduplication() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "category text not null" in sql
    assert "subcategory text" in sql
    assert "tags text[]" in sql
    assert "checksum text" in sql
    assert "ai_film_assets_project_checksum_uidx" in sql
    assert "using gin(tags)" in sql


def test_canon_and_scene_production_contracts_exist() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "ai_film_canon_rules" in sql
    assert "canon_validation jsonb" in sql
    assert "production_package jsonb" in sql
    assert "ai_film_rule_severity" in sql


def test_completed_dump_taxonomy_is_seeded() -> None:
    taxonomy = TAXONOMY.read_text(encoding="utf-8")

    source_files = {
        "1000004216.jpeg",
        "1000004219.jpeg",
        "1000004388.jpeg",
        "1000005012.png",
        "1000006370.png",
        "1000006394.jpeg",
        "1000006396.jpeg",
        "1000007725.jpeg",
        "1000007726.jpeg",
        "1000008296.jpeg",
        "1000008302.jpeg",
        "1000010478.jpeg",
        "1000010479.jpeg",
        "1000010481.jpeg",
        "1000010220.jpeg",
        "1000004486.jpeg",
    }

    for source_file in source_files:
        assert source_file in taxonomy

    assert taxonomy.count("sourceFilename:") == 16
