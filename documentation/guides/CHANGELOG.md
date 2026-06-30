# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-04-03

### Added
- Structured JSON logging across all services for better observability
- Exponential backoff retry logic (3 attempts) for all agent dispatches
- Enhanced `/health` endpoints reporting uptime, queue depth, and webhook counts
- `CONTRIBUTING.md` with autonomous agent workflow documentation
- Standardized issue templates: bug report, feature request, security
- `dependabot.yml` for automated weekly dependency updates
- CI workflow with flake8 linting, pytest coverage, and Trivy security scan
- Branch protection rules on `main` (no force-pushes, no deletions)
- Ecosystem labels: `ai-fix`, `auto-merge`, `security`, `performance`, `refactor`, `critical`, `autonomous`

### Changed
- All 9 repositories now registered with the Central Orchestrator webhook hub
- Gateway routing table expanded to explicitly handle all 9 ecosystem repositories
- `update.sh` enhanced with health checks, LaunchAgent restarts, and structured logging

### Security
- Applied all Snyk-recommended dependency upgrades
- Docker base image upgraded to `python:3.14.3-slim`
- npm packages: `@anthropic-ai/sdk`, `@supabase/supabase-js`, `lucide-react`, `@aws-sdk/*` all upgraded

## [1.0.0] — 2026-03-01

### Added
- Initial release of the Devonn Autonomous AI DevOps Ecosystem
- Central Orchestrator hub deployed to Render
- OpenClaw Gateway deployed to Render
- Webhook integration for all repositories
- AI agent dispatch system (security, refactor, debug, performance agents)
- Mac mini local execution node with one-command installer
- GitHub Actions auto-fix and auto-merge workflows

[Unreleased]: https://github.com/wesship/supreme-ai-deployment-hub/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/wesship/supreme-ai-deployment-hub/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/wesship/supreme-ai-deployment-hub/releases/tag/v1.0.0
