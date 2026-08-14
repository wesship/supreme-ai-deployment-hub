from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = ROOT / "backend" / "app" / "routers" / "primetime_custom_lists.py"
MAIN = ROOT / "backend" / "main.py"
MIGRATION = ROOT / "supabase" / "migrations" / "20260811024000_primetime_custom_lists_governed.sql"
CLIENT = ROOT / "src" / "lib" / "primetimeCustomListsApi.ts"
APP = ROOT / "src" / "App.tsx"


def test_router_is_mounted_once_at_canonical_path():
    router = ROUTER.read_text(encoding="utf-8")
    main = MAIN.read_text(encoding="utf-8")
    assert 'APIRouter(prefix="/primetime/v1"' in router
    assert "primetime_custom_lists_router" in main
    assert "app.include_router(primetime_custom_lists_router)" in main
    assert "primetime_custom_lists_mount" not in main


def test_mutations_use_atomic_rpc_boundary_and_no_direct_audit_write():
    source = ROUTER.read_text(encoding="utf-8")
    for rpc in (
        "primetime_create_custom_list",
        "primetime_update_custom_list",
        "primetime_archive_custom_list",
        "primetime_add_custom_list_member",
        "primetime_remove_custom_list_member",
    ):
        assert rpc in source
    assert "_audit(" not in source
    assert "_insert(" not in source
    assert "_patch(" not in source
    assert '@router.delete(' not in source


def test_archive_and_remove_http_verbs_match_client_contract():
    router = ROUTER.read_text(encoding="utf-8")
    client = CLIENT.read_text(encoding="utf-8")
    assert '@router.post("/custom-lists/{list_id}/archive")' in router
    assert '@router.post("/custom-lists/{list_id}/members/{person_id}/remove")' in router
    assert "post<PrimetimeCustomList>(`/primetime/v1/custom-lists/${listId}/archive`" in client
    assert "post<PrimetimeCustomListMember>(`/primetime/v1/custom-lists/${listId}/members/${personId}/remove`" in client


def test_schema_is_service_role_only_and_soft_delete_only():
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "alter table public.primetime_custom_lists enable row level security" in sql
    assert "alter table public.primetime_custom_list_members enable row level security" in sql
    assert "revoke all on table public.primetime_custom_lists from anon, authenticated" in sql
    assert "revoke all on table public.primetime_custom_list_members from anon, authenticated" in sql
    assert "grant all on table public.primetime_custom_lists to service_role" in sql
    assert "grant all on table public.primetime_custom_list_members to service_role" in sql
    assert "archived_at timestamptz" in sql
    assert "removed_at timestamptz" in sql
    assert "delete from public.primetime_custom_lists" not in sql.lower()
    assert "delete from public.primetime_custom_list_members" not in sql.lower()


def test_every_mutation_rpc_contains_audit_insert_and_sql_role_guard():
    sql = MIGRATION.read_text(encoding="utf-8")
    functions = (
        "primetime_create_custom_list",
        "primetime_update_custom_list",
        "primetime_archive_custom_list",
        "primetime_add_custom_list_member",
        "primetime_remove_custom_list_member",
    )
    for name in functions:
        marker = f"create or replace function public.{name}"
        assert marker in sql
        fragment = sql.split(marker, 1)[1].split("$$;", 1)[0]
        assert "primetime_custom_list_assert_role" in fragment
        assert "insert into public.primetime_audit_events" in fragment
    assert "array['manager','workspace_admin']::text[]" in sql
    assert "grant execute on function public.primetime_archive_custom_list" in sql
    assert "revoke all on function public.primetime_archive_custom_list" in sql


def test_frontend_requires_auth_and_routes_are_authenticated():
    client = CLIENT.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    assert "if (!token) throw new Error('Authentication is required for PRIMETIME Custom Lists.')" in client
    assert 'path="/primetime/custom-lists" element={<AuthenticatedRoute><PrimetimeCustomLists /></AuthenticatedRoute>}' in app
    assert 'path="/primetime/lists" element={<AuthenticatedRoute><PrimetimeCustomLists /></AuthenticatedRoute>}' in app
