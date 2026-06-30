# Architecture Changelog

All notable architectural changes to the D3VONN platform are documented in this file.

## [2.0] — 2026-06-30

### Added
- Domain-driven repository structure with clear separation of concerns
- Agent manifest system (`d3vonn.io/v1`) for dynamic discovery and orchestration
- Central registries for agents, knowledge, integrations, automation, and security
- Standardized event schema (14 platform events)
- Architecture Decision Records (ADRs) framework
- RBAC role definitions in security policies registry
- STRUCTURE.md documenting the repository layout

### Changed
- Reorganized flat directory structure into domain-driven layout
- Migrated all domain references from `devonn.ai` to `d3vonn.io`
- Renamed all `devonn` identifiers to `d3vonn` across the codebase
- Consolidated tests into unified `tests/` directory
- Moved browser extension to `integrations/extension/`
- Moved infrastructure configs to `infrastructure/`
- Updated all GitHub Actions workflows with new branding

### Removed
- Root-level clutter (73 files reduced to ~33)
- Duplicate documentation scattered across directories
- Orphaned configuration files

## [1.0] — 2025-12-01

### Added
- Initial React/Vite frontend
- FastAPI backend with Supabase integration
- Hermes governance engine (v3)
- DKOS knowledge modules
- Security operations foundation
- Agent marketplace UI
- Chrome browser extension
- GitHub Actions CI/CD pipeline
