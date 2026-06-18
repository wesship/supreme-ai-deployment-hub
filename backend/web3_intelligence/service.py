"""Service logic for Devonn.AI Web3 Intelligence.

The first implementation converts the clean Web3 smart-contract guide into
callable backend intelligence: guide retrieval, risk triage, contract blueprint
creation, event-routing plans, and RPC health checks.
"""

from __future__ import annotations

import hashlib
from typing import Any

import httpx

from .models import (
    ContractBlueprintRequest,
    ContractBlueprintResponse,
    ContractRiskRequest,
    ContractRiskResponse,
    ContractEventSubscription,
    ContractEventSubscriptionResponse,
    RiskFinding,
    RiskLevel,
    RpcHealthRequest,
    RpcHealthResponse,
    Web3GuideResponse,
    Web3GuideSection,
)

DISCLAIMER = (
    "Educational and planning output only. This is not legal, financial, tax, "
    "investment, securities, or insurance advice. Run legal/compliance review "
    "and smart-contract security review before controlling real assets."
)


def get_clean_guide() -> Web3GuideResponse:
    return Web3GuideResponse(
        title="Web3 Smart Contracts Guide — Devonn.AI Clean Version",
        version="1.0.0",
        purpose=(
            "Teach Web3 smart-contract fundamentals and turn them into Devonn.AI "
            "agent workflows, risk checks, and contract planning artifacts."
        ),
        recommended_path=[
            "Ingest this guide into RAG as web3_smart_contracts_guide.",
            "Use /api/web3/risk-check before any smart-contract build.",
            "Use /api/web3/blueprint to convert an idea into a project spec.",
            "Prototype only on testnet until audit, compliance, and custody plans are complete.",
        ],
        sections=[
            Web3GuideSection(
                slug="mental-model",
                title="Smart Contract Mental Model",
                summary="A smart contract is a public blockchain rules engine with code, state, address, functions, and events.",
                bullets=[
                    "Users sign transactions with wallets.",
                    "The blockchain validates the transaction.",
                    "The contract executes deterministic logic.",
                    "State changes are recorded on-chain.",
                ],
            ),
            Web3GuideSection(
                slug="business-use-cases",
                title="Business Use Cases",
                summary="Smart contracts are best for narrow, rules-based automation, not for replacing all business/legal systems.",
                bullets=[
                    "Token-gated access",
                    "NFT membership passes",
                    "Escrow",
                    "Revenue splitting",
                    "DAO governance",
                    "Real-world asset registries",
                    "Agent-triggered contract-event automations",
                ],
            ),
            Web3GuideSection(
                slug="devonn-integration",
                title="Devonn.AI Integration Pattern",
                summary="Devonn.AI should treat smart contracts as one layer in a wider automation, compliance, CRM, and knowledge system.",
                bullets=[
                    "Listen to contract events and route them to agents.",
                    "Use RAG to explain contracts and guide users.",
                    "Sync wallet activity into CRM/contact records.",
                    "Flag risky admin, treasury, and tokenization actions.",
                ],
            ),
            Web3GuideSection(
                slug="security",
                title="Security Principles",
                summary="Security must be part of the build process before mainnet or real assets are involved.",
                bullets=[
                    "Use battle-tested libraries.",
                    "Prefer multisig administration.",
                    "Document upgrade authority.",
                    "Use pause controls where appropriate.",
                    "Test external calls, oracle dependence, and edge cases.",
                    "Monitor after deployment.",
                ],
            ),
        ],
    )


def _max_risk(current: RiskLevel, candidate: RiskLevel) -> RiskLevel:
    order = [RiskLevel.low, RiskLevel.medium, RiskLevel.high, RiskLevel.critical]
    return candidate if order.index(candidate) > order.index(current) else current


def risk_check(req: ContractRiskRequest) -> ContractRiskResponse:
    findings: list[RiskFinding] = []
    score = 100
    overall = RiskLevel.low

    def add(level: RiskLevel, category: str, finding: str, recommendation: str, penalty: int) -> None:
        nonlocal score, overall
        findings.append(RiskFinding(level=level, category=category, finding=finding, recommendation=recommendation))
        score = max(0, score - penalty)
        overall = _max_risk(overall, level)

    if req.controls_real_value:
        add(
            RiskLevel.high,
            "asset-control",
            "The proposed contract controls or routes real value.",
            "Use testnet first, require audit/security review, define treasury controls, and avoid single-wallet administration.",
            18,
        )

    if req.represents_real_world_asset:
        add(
            RiskLevel.high,
            "real-world-asset",
            "The contract appears to represent an off-chain asset or legal claim.",
            "Create legal agreements, custody records, appraisal records, redemption rules, and compliance review before token issuance.",
            20,
        )

    if req.uses_upgradeable_proxy and not req.has_multisig_admin:
        add(
            RiskLevel.critical,
            "upgradeability",
            "Upgradeable proxy is planned without multisig administration.",
            "Put upgrade authority behind multisig and consider timelock/public upgrade process.",
            25,
        )
    elif req.uses_upgradeable_proxy:
        add(
            RiskLevel.medium,
            "upgradeability",
            "Upgradeable proxy adds governance and admin-key risk.",
            "Document proxy pattern, upgrade admin, rollback plan, timelock policy, and user disclosure.",
            10,
        )

    if not req.has_multisig_admin and (req.controls_real_value or req.uses_upgradeable_proxy):
        add(
            RiskLevel.high,
            "access-control",
            "Sensitive control appears tied to non-multisig administration.",
            "Use Safe or another mature multisig for owner/admin/pauser/upgrader roles.",
            18,
        )

    if not req.has_pause_function and req.controls_real_value:
        add(
            RiskLevel.medium,
            "incident-response",
            "No emergency pause function is planned for a value-controlling contract.",
            "Add a narrowly scoped pause function and define who can trigger it.",
            8,
        )

    if req.uses_oracle:
        add(
            RiskLevel.medium,
            "oracle",
            "External/off-chain data dependency introduces oracle manipulation or availability risk.",
            "Use reputable data sources, stale-data checks, fallback behavior, and circuit breakers.",
            10,
        )

    if req.has_external_calls:
        add(
            RiskLevel.medium,
            "external-calls",
            "External calls can introduce reentrancy and unexpected execution behavior.",
            "Use checks-effects-interactions, reentrancy guards, and tests against malicious receiver contracts.",
            10,
        )

    if req.use_case.value in {"token", "rwa_tokenization", "revenue_split"} and not req.has_kyc_or_allowlist:
        add(
            RiskLevel.medium,
            "compliance-boundary",
            "The use case may involve transfer, ownership, payments, or investor/customer eligibility concerns.",
            "Review whether KYC, allowlisting, transfer restrictions, disclosures, or jurisdiction limits are needed.",
            12,
        )

    if not findings:
        findings.append(
            RiskFinding(
                level=RiskLevel.low,
                category="initial-readiness",
                finding="No major red flags were detected from the supplied inputs.",
                recommendation="Proceed with testnet prototype, written specification, unit tests, and security review before production.",
            )
        )

    next_steps = [
        "Write a contract specification before coding.",
        "Create a testnet-only prototype.",
        "Add unit tests, negative tests, and event tests.",
        "Document admin roles, upgrade policy, and emergency controls.",
        "Run legal/compliance review before tokenization, custody, financial, insurance, or investment use cases.",
    ]
    if req.represents_real_world_asset:
        next_steps.insert(0, "Create a real-world asset custody/appraisal/legal-record package before token issuance.")
    if req.controls_real_value:
        next_steps.insert(0, "Require multisig treasury/admin control before mainnet.")

    return ContractRiskResponse(
        project_name=req.name,
        overall_risk=overall,
        readiness_score=score,
        findings=findings,
        next_steps=next_steps,
        disclaimer=DISCLAIMER,
    )


def build_blueprint(req: ContractBlueprintRequest) -> ContractBlueprintResponse:
    architecture = [
        "Frontend wallet connection layer",
        "Devonn.AI backend API layer",
        "Smart contract layer on selected EVM chain",
        "Event listener / indexer layer",
        "Agent routing layer for Web3 events",
        "CRM, knowledge-base, compliance, and audit-record storage",
    ]

    smart_contract_requirements = [
        f"Implement contract logic for use case: {req.use_case.value}.",
        "Emit events for every important state change.",
        "Use explicit access-control roles for admin actions.",
        "Verify source code on chain explorer after deployment.",
    ]
    if req.assets_controlled:
        smart_contract_requirements.append("Define controlled assets: " + ", ".join(req.assets_controlled) + ".")
    if req.immutable_or_upgradeable == "upgradeable":
        smart_contract_requirements.append("Use audited proxy pattern with multisig upgrade admin and documented timelock policy.")
    elif req.immutable_or_upgradeable == "immutable":
        smart_contract_requirements.append("Design immutable deployment with migration strategy for future versions.")
    else:
        smart_contract_requirements.append("Decide immutable vs upgradeable before implementation.")

    backend_requirements = [
        "Expose contract metadata through /api/web3 endpoints.",
        "Store wallet-to-contact mapping outside the contract if CRM integration is needed.",
        "Persist event-processing checkpoints to avoid duplicate agent actions.",
        "Keep private keys out of the backend unless a dedicated signing/custody design is approved.",
    ]
    if req.off_chain_data:
        backend_requirements.append("Maintain off-chain records: " + ", ".join(req.off_chain_data) + ".")

    agent_workflows = [
        "Contract event triage agent classifies events by business impact.",
        "Compliance agent flags risky transfers, missing records, and admin changes.",
        "CRM agent updates customer/contact timeline from wallet activity.",
        "Knowledge agent explains contract actions to non-technical users.",
    ]

    security_requirements = [
        "Multisig for owner/admin/pauser/upgrader roles.",
        "Unit tests for allowed and forbidden actions.",
        "Fuzz tests for value-transfer and accounting logic.",
        "Reentrancy protection for external calls.",
        "Emergency pause and documented incident response where value is controlled.",
        "Independent review before mainnet.",
    ]

    compliance_questions = [
        "Does the project create an investment contract, security, lending product, insurance product, or money-transmission flow?",
        "Who can buy, hold, transfer, redeem, or access the token/contract benefit?",
        "What jurisdiction rules apply to the users and the operating company?",
        "What disclosures, custody records, tax records, or consumer-protection records are required?",
    ]
    if req.compliance_notes:
        compliance_questions.append("Specific compliance note supplied: " + req.compliance_notes)

    deployment_checklist = [
        "Write PRD/specification.",
        "Build local prototype.",
        "Deploy to testnet.",
        "Run automated tests and static analysis.",
        "Review admin keys and multisig setup.",
        "Verify contract source.",
        "Connect event listener to Devonn.AI agents.",
        "Run limited pilot.",
        "Complete audit/compliance review.",
        "Deploy production only after sign-off.",
    ]

    return ContractBlueprintResponse(
        project_name=req.project_name,
        architecture=architecture,
        smart_contract_requirements=smart_contract_requirements,
        backend_requirements=backend_requirements,
        agent_workflows=agent_workflows,
        security_requirements=security_requirements,
        compliance_questions=compliance_questions,
        deployment_checklist=deployment_checklist,
    )


def plan_event_subscription(req: ContractEventSubscription) -> ContractEventSubscriptionResponse:
    digest_source = f"{req.chain_id}:{req.contract_address.lower()}:{req.event_name}:{req.webhook_url}:{req.agent_route}"
    subscription_id = "web3evt_" + hashlib.sha256(digest_source.encode("utf-8")).hexdigest()[:16]

    routing_plan = [
        f"Listen on chain_id={req.chain_id} for {req.event_name} from {req.contract_address}.",
        "Normalize event payload into Devonn.AI Web3 event schema.",
        "Deduplicate by transaction hash + log index.",
        "Persist processing checkpoint before dispatch.",
    ]
    if req.webhook_url:
        routing_plan.append(f"Forward normalized event to webhook: {req.webhook_url}.")
    if req.agent_route:
        routing_plan.append(f"Dispatch event to agent route: {req.agent_route}.")
    if not req.webhook_url and not req.agent_route:
        routing_plan.append("No webhook or agent route supplied; keep this as a planned subscription until routing is configured.")

    return ContractEventSubscriptionResponse(
        subscription_id=subscription_id,
        status="planned",
        summary="Event subscription plan created. Persistence/indexer activation should be wired in the next production step.",
        routing_plan=routing_plan,
    )


async def check_rpc_health(req: RpcHealthRequest) -> RpcHealthResponse:
    payloads = [
        {"jsonrpc": "2.0", "id": 1, "method": "eth_chainId", "params": []},
        {"jsonrpc": "2.0", "id": 2, "method": "eth_blockNumber", "params": []},
    ]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            responses: list[dict[str, Any]] = []
            for payload in payloads:
                response = await client.post(str(req.rpc_url), json=payload)
                response.raise_for_status()
                responses.append(response.json())
    except Exception as exc:  # noqa: BLE001 - user-facing health response
        return RpcHealthResponse(
            ok=False,
            chain_id_expected=req.chain_id,
            message=f"RPC health check failed: {exc}",
        )

    chain_hex = responses[0].get("result")
    block_hex = responses[1].get("result")
    reported = int(chain_hex, 16) if isinstance(chain_hex, str) and chain_hex.startswith("0x") else None

    ok = reported == req.chain_id and isinstance(block_hex, str)
    return RpcHealthResponse(
        ok=ok,
        chain_id_expected=req.chain_id,
        chain_id_reported=reported,
        latest_block_hex=block_hex if isinstance(block_hex, str) else None,
        message="RPC is reachable and chain ID matches." if ok else "RPC reached, but chain ID or block response did not match expectations.",
        raw={"chain_id": responses[0], "block_number": responses[1]},
    )
