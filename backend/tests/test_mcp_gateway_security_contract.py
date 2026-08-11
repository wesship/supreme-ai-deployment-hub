from pathlib import Path


APP = Path("src/App.tsx").read_text()
EXPLORER = Path("src/components/mcp/McpToolExplorer.tsx").read_text()
GATEWAY = Path("supabase/functions/mcp-gateway/index.ts").read_text()
STDIO = Path("supabase/functions/mcp-stdio-proxy/index.ts").read_text()
CONFIG = Path("supabase/config.toml").read_text()


def test_mcp_route_requires_authentication():
    assert '<Route path="/mcp" element={<AuthenticatedRoute><McpPage /></AuthenticatedRoute>} />' in APP


def test_browser_uses_authenticated_edge_functions_not_client_upstream_url():
    assert 'supabase.auth.getSession()' in EXPLORER
    assert 'mcp-stdio-proxy' in EXPLORER
    assert 'mcp-gateway' in EXPLORER
    assert 'x-mcp-gateway-url' not in EXPLORER.lower()


def test_edge_functions_are_jwt_protected():
    assert '[functions.mcp-gateway]\nverify_jwt = true' in CONFIG
    assert '[functions.mcp-stdio-proxy]\nverify_jwt = true' in CONFIG


def test_gateway_urls_are_server_controlled_and_no_local_fallback_exists():
    assert 'Deno.env.get("MCP_GATEWAY_URL")' in GATEWAY
    assert 'Deno.env.get("MCP_STDIO_GATEWAY_URL")' in STDIO
    assert 'gatewayUrl?: string' not in GATEWAY
    assert 'http://gateway-remote:8080/mcp' not in GATEWAY


def test_canonical_d3vonn_origins_are_allowlisted():
    for source in (GATEWAY, STDIO):
        assert 'https://www.d3vonn.io' in source
        assert 'https://d3vonn.io' in source
        assert 'origin_not_allowed' in source
        assert 'Access-Control-Allow-Origin": "*"' not in source
