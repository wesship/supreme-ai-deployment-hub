from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "ai-films-supabase-rollout.yml"


def workflow_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def test_rollout_declares_controlled_dispatch_inputs():
    workflow = workflow_text()

    assert "options: [staging, production]" in workflow
    assert "options: [preview, apply]" in workflow
    assert "type: boolean" in workflow
    assert "APPLY_AI_FILMS" in workflow


def test_rollout_uses_selected_protected_environment():
    workflow = workflow_text()

    assert "environment: ${{ inputs.target }}" in workflow
    assert "Production apply requires approval through the protected GitHub environment." in workflow


def test_rollout_reports_each_missing_secret_explicitly():
    workflow = workflow_text()

    for secret_name in (
        "SUPABASE_ACCESS_TOKEN",
        "SUPABASE_PROJECT_ID",
        "SUPABASE_DB_PASSWORD",
    ):
        assert f'require_secret "{secret_name}"' in workflow

    assert "Missing Supabase environment secret" in workflow
    assert "Environment secrets" in workflow
    assert 'test -n "$SUPABASE_' not in workflow


def test_rollout_pins_and_verifies_supabase_cli():
    workflow = workflow_text()

    assert "version: 2.109.1" in workflow
    assert 'test "$(supabase --version)" = "2.109.1"' in workflow
    assert "version: latest" not in workflow


def test_rollout_uses_validated_link_lint_and_push_flags():
    workflow = workflow_text()

    assert 'supabase link --project-ref "$SUPABASE_PROJECT_ID" --password "$SUPABASE_DB_PASSWORD"' in workflow
    assert "supabase db lint --linked --level warning" in workflow
    assert 'supabase db push --linked --dry-run --password "$SUPABASE_DB_PASSWORD"' in workflow
    assert 'supabase db push --linked --password "$SUPABASE_DB_PASSWORD"' in workflow


def test_apply_and_optional_function_deploy_remain_gated():
    workflow = workflow_text()

    assert "if: inputs.mode == 'apply'" in workflow
    assert "if: inputs.mode == 'apply' && inputs.deploy_function" in workflow
    assert 'supabase functions deploy ai-film-companion --project-ref "$SUPABASE_PROJECT_ID" --use-api' in workflow


def test_production_rollout_contains_no_destructive_database_flags():
    workflow = workflow_text()

    assert "supabase db reset" not in workflow
    assert "--include-seed" not in workflow
    assert "--include-all" not in workflow
