from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / 'supabase/migrations/20260725021000_ai_film_storage.sql'
OPENEXR_MIGRATION = ROOT / 'supabase/migrations/20260815220500_allow_ai_film_openexr.sql'
SERVICE = ROOT / 'src/features/ai-films/storagePackageService.ts'


def test_private_ai_film_bucket_and_owner_policies_exist():
    sql = MIGRATION.read_text(encoding='utf-8')
    assert "'ai-film-media'" in sql
    assert 'public, file_size_limit' in sql
    assert 'owners read ai film media' in sql
    assert 'owners upload ai film media' in sql
    assert '(storage.foldername(name))[1] = auth.uid()::text' in sql


def test_openexr_storage_mime_types_are_allowed():
    sql = OPENEXR_MIGRATION.read_text(encoding='utf-8')
    assert "where id = 'ai-film-media'" in sql
    assert "'image/x-exr'" in sql
    assert "'image/exr'" in sql


def test_upload_service_requires_authentication_and_records_asset():
    source = SERVICE.read_text(encoding='utf-8')
    assert 'supabase.auth.getUser' in source
    assert "from(BUCKET).upload" in source
    assert "from('ai_film_assets').insert" in source
    assert 'storage_path: storagePath' in source
    assert "from(BUCKET).remove" in source


def test_upload_service_normalizes_openexr_content_type():
    source = SERVICE.read_text(encoding='utf-8')
    assert 'resolveFilmAssetContentType' in source
    assert "endsWith('.exr')" in source
    assert "return 'image/x-exr'" in source
    assert 'contentType,' in source
    assert 'mime_type: contentType' in source


def test_signed_previews_and_production_packages_are_supported():
    source = SERVICE.read_text(encoding='utf-8')
    assert 'createSignedUrl' in source
    assert 'saveProductionPackage' in source
    assert 'production_package: productionPackage' in source


def test_detailed_release_readiness_is_calculated():
    source = SERVICE.read_text(encoding='utf-8')
    assert 'getReleaseReadinessDetails' in source
    assert 'uploadedAssets' in source
    assert 'canonAssets' in source
    assert 'passingScenes' in source
    assert 'packagedScenes' in source
