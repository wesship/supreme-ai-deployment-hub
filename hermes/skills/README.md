# Hermes Skills

This directory defines D3VONN.IO's approved Hermes capability layer.

## Rules

- Skills are selected from the governed `backend.hermes.skills` registry.
- Unknown, disabled, under-permissioned, or agent-incompatible skills fail closed.
- A skill does not bypass the Tool Registry, Agent Firewall, RBAC, or human approval.
- External plugins are pinned before production use.
- Destructive, financial, production, credential, and external-write actions remain policy/approval gated.

## Initial approved set

| Skill | Purpose | Default agents | Risk |
|---|---|---|---|
| `superpowers-dev` | Plan-first coding, TDD, debugging, worktrees, code review, verification | Hermes, TARS | medium |
| `browser-execution` | Governed browser/computer execution | Hermes, TARS | high |
| `knowledge-writeback` | Write verified outcomes into memory/knowledge graph | Hermes, SAPPHIRE | low |
| `release-gate` | Tests + security + review + approval before release | Hermes, GUARDIAN, TARS | critical |

## Superpowers pin

The initial Superpowers source is pinned to:

`obra/superpowers@5bf4e78011075bcfc0dc295f0724994cd123ee71`

Install on a Hermes host with:

```bash
./scripts/hermes/install-approved-plugins.sh
```

Restart active Hermes sessions after installation so the plugin bootstrap is loaded.
