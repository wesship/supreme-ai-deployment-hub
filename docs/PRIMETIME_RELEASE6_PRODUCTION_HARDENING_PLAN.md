# PRIMETIME Release 6 — Production Hardening Plan

## Purpose

Release 6 turns the PRIMETIME stack from feature-complete foundation into a production-ready operating system for governed insurance-agent workflows.

This release focuses on QA gates, observability, deployment readiness, rollback discipline, operational runbooks, compliance guardrails, and full-stack stabilization across Releases 1 through 5.

## Stack dependency

Release 6 is stacked on Release 5 and depends on:

- Release 1 CRM foundation
- Release 2 scheduling and daily operations
- Release 3 governed communications
- Release 4 AI assistance
- Release 5 analytics and executive command center

## Production hardening scope

### 1. Quality assurance gates

Required release gates:

- Static schema tests
- Static API endpoint tests
- Static UI route tests
- Seeded Playwright E2E flows
- Migration file validation
- No DELETE endpoint validation for regulated PRIMETIME surfaces
- No autonomous send/quote/policy recommendation/application-submission validation
- RBAC and workspace guard validation
- Audit-write validation
- Compliance boundary validation

### 2. Observability

Required observability surfaces:

- Request logging
- Error tracking
- Audit event visibility
- Release-governance observations
- AI action ledger monitoring
- Communication policy check monitoring
- Scheduling exception monitoring
- Dashboard and analytics snapshot monitoring
- Deployment health check visibility

### 3. Deployment readiness

Deployment readiness requires:

- Environment variable inventory
- Supabase migration order documented
- Frontend route inventory documented
- Backend route inventory documented
- Rollback plan documented
- Incident response plan documented
- Security and compliance review checklist documented
- Known external blocker documentation

### 4. Stack stabilization

Stabilization work includes:

- Stack-level readiness matrix
- Release-by-release dependency map
- Guardrail checklist
- Production launch checklist
- Operator runbook
- Post-deployment validation checklist

## Non-negotiable production boundaries

PRIMETIME production must preserve these boundaries:

- No lead without owner
- No open opportunity without next action
- No communication without consent check
- No AI execution without audit
- No regulated recommendation without licensed human review
- No unapproved communication template in production
- No hard delete for regulated records
- No autonomous outbound sales calling
- No quote generation endpoint
- No policy recommendation endpoint
- No application submission endpoint
- No sensitive export without authorization
- No business-critical state only in n8n
- No agent bypassing compliance gates

## Required Release 6 deliverables

- `docs/PRIMETIME_RELEASE6_PRODUCTION_HARDENING_PLAN.md`
- `docs/PRIMETIME_PRODUCTION_READINESS_CHECKLIST.md`
- `docs/PRIMETIME_RELEASE_STACK_RUNBOOK.md`
- `config/primetime-release-gates.json`
- `backend/tests/test_primetime_release6_production_hardening_static.py`

## Out of scope

- Live production deployment
- Secret rotation execution
- Database migration execution
- Carrier API production integration
- Autonomous messaging delivery
- Autonomous AI sales execution

## Exit criteria

Release 6 is ready when:

- Stack readiness is documented
- Production checks are encoded in config
- Static tests protect production boundaries
- Deployment readiness checklist exists
- Operator runbook exists
- Known external blockers are documented
- PR is mergeable and ready for review
