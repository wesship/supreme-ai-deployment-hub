from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "api" / "primetime-staging-health.py"
PAGE = ROOT / "public" / "primetime-staging.html"


def test_staging_proxy_uses_environment_configuration_only():
    source = API.read_text()
    assert "PRIMETIME_STAGING_SUPABASE_URL" in source
    assert "PRIMETIME_STAGING_SUPABASE_ANON_KEY" in source
    assert "eyJ" not in source
    assert "hyeqzvkmwayohmuukups" not in source


def test_staging_console_is_read_only_and_noindex():
    html = PAGE.read_text()
    assert 'name="robots" content="noindex,nofollow"' in html
    assert "READ ONLY" in html
    assert "Production promotion" in html
    assert "BLOCKED" in html
    assert "fetch('/api/primetime-staging-health'" in html
