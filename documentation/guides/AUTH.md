# AUTH.md

## Purpose

Authentication and Authorization Authority for D3VONN.

This document defines who may perform actions, under what conditions, and what evidence is required before protected operations occur.

## Rule Zero

No gate may be marked GREEN without evidence.

Accepted evidence:
- HTTP responses
- CI logs
- Deployment artifacts
- DNS verification
- Sentry verification
- Security verification

## Identity Hierarchy

SUPER_ADMIN
OPERATOR
AGENT_MANAGER
DEVELOPER
USER
GUEST

## OpenClaw Authority

claw-01 Strategic Authority
claw-02 Engineering Authority
claw-03 Design Authority
claw-04 QA Authority
claw-05 Security Authority

## Hermes Authority

Hermes manages:
- memory
- approvals
- context retrieval
- HITL governance

Hermes does not execute production changes.

## GStack Agent Permissions

/ceo
Roadmap and prioritization

/eng-manager
Architecture decisions

/build
Implementation tasks

/review
Code review

/qa
Validation and evidence collection

/security
Threat review and audit

/release
Release preparation

/ship
May only proceed when required gates have evidence.

## HITL Required Actions

Human approval required for:
- production deployments
- secret rotation
- destructive database operations
- repository deletion
- billing changes
- user deletion

## Gate Requirements

DNS
Health
CI
Sentry
Bundle
HMAC
HITL

All required shipping gates must contain evidence before release approval.

## Secrets Policy

Never store:
- API keys
- passwords
- access tokens
- credentials

Use:
- GitHub Secrets
- Railway Secrets
- Supabase Secrets
- AWS Secrets Manager

## Source of Truth

CLAUDE.md
AUTH.md
AGENTS.md
GATES.md
