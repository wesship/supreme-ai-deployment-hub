# Contributing to the Devonn Ecosystem

Thank you for contributing to the Devonn Autonomous AI DevOps Ecosystem. This document outlines the process for submitting changes, reporting issues, and working with the autonomous agent system.

---

## Quick Start

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-fork>/<repo>.git
cd <repo>

# 2. Create a feature branch
git checkout -b feat/your-feature-name

# 3. Make your changes and run tests
python -m pytest tests/ -v

# 4. Push and open a PR
git push origin feat/your-feature-name
```

---

## Branch Naming Convention

| Prefix | Purpose | Example |
|---|---|---|
| `feat/` | New features | `feat/add-agent-memory` |
| `fix/` | Bug fixes | `fix/jwt-expiry-bug` |
| `chore/` | Maintenance | `chore/update-deps` |
| `docs/` | Documentation | `docs/api-reference` |
| `security/` | Security patches | `security/cve-2026-xxxx` |

---

## Autonomous Agent Workflow

This repository is connected to the **Devonn Central Orchestrator** at `https://central-orchestrator.onrender.com`. When you open a PR or push code:

1. The **Debug Agent** scans for runtime errors and test failures.
2. The **Security Agent** checks for vulnerabilities (Snyk, bandit).
3. The **Refactor Agent** suggests code quality improvements.
4. The **Performance Agent** flags slow paths and memory leaks.

If any agent generates a fix, it will open a follow-up PR automatically. You can trigger agents manually by adding the label `ai-fix` to any issue.

---

## Pull Request Requirements

- All tests must pass (`pytest tests/ -v`)
- No new linting errors (`flake8 --max-line-length=120`)
- PR description must explain **what** and **why**
- Add the `auto-merge` label if the PR is low-risk and CI-verified

---

## Reporting Issues

Use the issue templates provided in `.github/ISSUE_TEMPLATE/`. For security vulnerabilities, please email `security@wesship.io` rather than opening a public issue.

---

## Code of Conduct

Be respectful, constructive, and collaborative. The autonomous agents will handle the mechanical work — your job is the creative and architectural thinking.
