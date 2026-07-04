# DEVONN.AI Claude Code + Ruflo Operating Rules

This repository is configured for Ruflo multi-agent orchestration through Claude Code MCP.

## Prime directive

Build DEVONN.AI safely: read before writing, preserve production stability, never expose secrets, and keep every change traceable through tests or a clear validation path.

## Agent routing

Use Ruflo for parallel work, but keep authority layered:

- Strategic agents: architecture, decomposition, security review, release planning. Read-only by default.
- Builder agents: implementation, migrations, UI/API wiring, tests.
- Verification agents: lint, typecheck, unit tests, security scan, deployment review.

Prefer hierarchical swarms for production changes. Use mesh/adaptive swarms only for research, refactors, or non-production experiments.

## Repository guardrails

- Never commit `.env`, credentials, API keys, tokens, private keys, cookies, or production secrets.
- Always read a file before editing it.
- Prefer editing existing files over creating new files.
- Do not create documentation just to create documentation; create it only when it supports setup, operations, or handoff.
- Do not bypass CI, tests, security scans, or domain/deployment checks.
- For Vercel, Railway, Supabase, Pinecone, AWS, and GitHub Actions changes, make the smallest safe change and document the validation result.

## D3VONN.IO design authority

Public-facing D3VONN.IO design work must follow `design.md`.

Use this split:

- `CLAUDE.md` = repo operations, safety, architecture context, and validation rules.
- `design.md` = visual system, anti-patterns, copy tone, layout rules, color system, and design testing rules.

Design changes should avoid generic AI-site patterns, excessive symmetry, generic centered CTAs, default icon grids, and filler marketing language. When possible, encode visual anti-patterns as tests before or alongside the design change.

## Standard validation

Before marking work complete, run the relevant subset:

```bash
pnpm security:scan
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For full repo audit:

```bash
pnpm audit:repo
```

For D3VONN.IO public design changes:

```bash
pnpm test:design
pnpm test:visual
```

## Ruflo starter commands

Local setup:

```bash
bash scripts/setup-ruflo.sh
```

Manual fallback:

```bash
npm install -g ruflo@latest
npx ruflo@latest init
claude mcp add ruflo -- npx ruflo@latest mcp start
```

## First recommended DEVONN swarm prompt

```text
Use Ruflo in hierarchical mode. Audit DEVONN.AI for deployment blockers, domain/DNS issues, security regressions, failing tests, and agent-orchestration gaps. Read before writing, do not touch secrets, and produce a patch plan before edits.
```
