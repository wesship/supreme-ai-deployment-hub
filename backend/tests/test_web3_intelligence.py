from backend.web3_intelligence.models import (
    ContractBlueprintRequest,
    ContractRiskRequest,
    ContractUseCase,
)
from backend.web3_intelligence.service import build_blueprint, get_clean_guide, risk_check


def test_web3_guide_has_devonn_integration_section():
    guide = get_clean_guide()
    slugs = {section.slug for section in guide.sections}
    assert "devonn-integration" in slugs
    assert guide.title.startswith("Web3 Smart Contracts Guide")


def test_risk_check_flags_rwa_without_multisig():
    result = risk_check(
        ContractRiskRequest(
            name="Jewelry Asset Token",
            use_case=ContractUseCase.rwa_tokenization,
            description="Token representing appraised jewelry ownership or access rights.",
            controls_real_value=True,
            uses_upgradeable_proxy=True,
            has_multisig_admin=False,
            has_pause_function=False,
            uses_oracle=True,
            has_external_calls=True,
            has_kyc_or_allowlist=False,
            represents_real_world_asset=True,
        )
    )
    assert result.overall_risk in {"high", "critical"}
    assert result.readiness_score < 70
    assert any(f.category == "real-world-asset" for f in result.findings)


def test_blueprint_generates_agent_workflows():
    result = build_blueprint(
        ContractBlueprintRequest(
            project_name="Token-Gated Client Portal",
            use_case=ContractUseCase.token_gated_access,
            target_users=["clients", "admins"],
            assets_controlled=["membership access"],
            admin_roles=["owner", "pauser"],
            on_chain_data=["membership token ownership"],
            off_chain_data=["CRM contact record", "consent logs"],
            payments="none in v1",
            immutable_or_upgradeable="undecided",
        )
    )
    assert result.project_name == "Token-Gated Client Portal"
    assert result.agent_workflows
    assert any("CRM" in item for item in result.agent_workflows)
