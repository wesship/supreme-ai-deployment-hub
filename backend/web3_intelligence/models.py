"""Pydantic models for Devonn.AI Web3 Intelligence.

This module intentionally avoids chain-specific dependencies so the first Web3
layer can run inside the existing FastAPI backend without adding heavyweight
packages. RPC and indexing integrations can be added behind the service layer.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ContractUseCase(str, Enum):
    education = "education"
    token = "token"
    nft = "nft"
    escrow = "escrow"
    dao = "dao"
    token_gated_access = "token_gated_access"
    rwa_tokenization = "rwa_tokenization"
    revenue_split = "revenue_split"
    agent_event_automation = "agent_event_automation"


class Web3GuideSection(BaseModel):
    slug: str
    title: str
    summary: str
    bullets: list[str] = Field(default_factory=list)


class Web3GuideResponse(BaseModel):
    title: str
    version: str
    purpose: str
    recommended_path: list[str]
    sections: list[Web3GuideSection]


class ContractRiskRequest(BaseModel):
    name: str = Field(..., description="Project, token, or contract name.")
    use_case: ContractUseCase
    description: str = Field(..., min_length=10)
    controls_real_value: bool = False
    uses_upgradeable_proxy: bool = False
    has_multisig_admin: bool = False
    has_pause_function: bool = False
    uses_oracle: bool = False
    has_external_calls: bool = False
    has_kyc_or_allowlist: bool = False
    represents_real_world_asset: bool = False
    jurisdiction_notes: str | None = None


class RiskFinding(BaseModel):
    level: RiskLevel
    category: str
    finding: str
    recommendation: str


class ContractRiskResponse(BaseModel):
    project_name: str
    overall_risk: RiskLevel
    readiness_score: int = Field(..., ge=0, le=100)
    findings: list[RiskFinding]
    next_steps: list[str]
    disclaimer: str


class ContractBlueprintRequest(BaseModel):
    project_name: str
    use_case: ContractUseCase
    target_users: list[str] = Field(default_factory=list)
    assets_controlled: list[str] = Field(default_factory=list)
    admin_roles: list[str] = Field(default_factory=list)
    on_chain_data: list[str] = Field(default_factory=list)
    off_chain_data: list[str] = Field(default_factory=list)
    payments: str | None = None
    immutable_or_upgradeable: Literal["immutable", "upgradeable", "undecided"] = "undecided"
    compliance_notes: str | None = None


class ContractBlueprintResponse(BaseModel):
    project_name: str
    architecture: list[str]
    smart_contract_requirements: list[str]
    backend_requirements: list[str]
    agent_workflows: list[str]
    security_requirements: list[str]
    compliance_questions: list[str]
    deployment_checklist: list[str]


class ContractEventSubscription(BaseModel):
    chain_id: int = Field(..., description="EVM chain ID, such as 1, 8453, 137, or 11155111.")
    contract_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")
    event_name: str
    webhook_url: HttpUrl | None = None
    agent_route: str | None = Field(
        default=None,
        description="Optional Devonn.AI internal agent route, such as hermes.web3_event_triage.",
    )
    notes: str | None = None


class ContractEventSubscriptionResponse(BaseModel):
    subscription_id: str
    status: Literal["planned", "active", "disabled"]
    summary: str
    routing_plan: list[str]


class RpcHealthRequest(BaseModel):
    rpc_url: HttpUrl
    chain_id: int


class RpcHealthResponse(BaseModel):
    ok: bool
    chain_id_expected: int
    chain_id_reported: int | None = None
    latest_block_hex: str | None = None
    message: str
    raw: dict[str, Any] | None = None
