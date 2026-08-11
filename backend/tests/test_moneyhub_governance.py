from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20260811033000_moneyhub_governed_mutations.sql"
PAGE = ROOT / "src" / "pages" / "MoneyHub.tsx"


def test_moneyhub_financial_tables_are_not_browser_mutable():
    sql = MIGRATION.read_text()
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.agent_earnings FROM authenticated" in sql
    assert "REVOKE INSERT, UPDATE, DELETE ON TABLE public.money_agents FROM authenticated" in sql
    assert "GRANT SELECT ON TABLE public.money_agents TO authenticated" in sql
    assert "GRANT SELECT ON TABLE public.agent_earnings TO authenticated" in sql


def test_moneyhub_mutations_are_authenticated_security_definer_rpcs():
    sql = MIGRATION.read_text()
    assert "CREATE OR REPLACE FUNCTION public.moneyhub_create_agent" in sql
    assert "CREATE OR REPLACE FUNCTION public.moneyhub_set_agent_status" in sql
    assert sql.count("SECURITY DEFINER") >= 2
    assert sql.count("auth.uid()") >= 2
    assert "GRANT EXECUTE ON FUNCTION public.moneyhub_create_agent" in sql
    assert "GRANT EXECUTE ON FUNCTION public.moneyhub_set_agent_status" in sql


def test_moneyhub_page_does_not_directly_write_financial_tables():
    source = PAGE.read_text()
    assert ".from('agent_earnings').insert" not in source
    assert ".from('agent_earnings').update" not in source
    assert ".from('money_agents').insert" not in source
    assert ".from('money_agents').update" not in source
    assert "moneyhub_create_agent" in source
    assert "moneyhub_set_agent_status" in source


def test_moneyhub_realtime_publication_is_idempotent():
    sql = MIGRATION.read_text()
    assert "pg_publication_tables" in sql
    assert "ALTER PUBLICATION supabase_realtime ADD TABLE public.money_agents" in sql
