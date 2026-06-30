# Storybook Layer: BrandForge

## Purpose

BrandForge is the D3VONN.IO brand-to-site production layer. It converts approved brand inputs into a strategy-backed landing page, website refresh, campaign page, visuals, motion assets, GitHub pull request, and Vercel deployment path.

The goal is not just to generate a website quickly. The goal is to prevent generic AI output by forcing brand strategy, positioning, creative direction, asset provenance, and human approval before final deployment.

## Core Workflow

```text
Brand Crawl → Brand Kit → Creative Direction → Visual Generation → Motion Assembly → Site Build → QA → GitHub/Vercel Deploy
```

## Agent Roles

- Firecrawl Research Agent
- Brand Strategist Agent
- Creative Director Agent
- Nano Banana Visual Agent
- OpenMontage Video Agent
- Claude Code Builder Agent
- QA Guardian Agent
- Deployment Agent

## Required Guardrails

- Only crawl approved URLs.
- Do not reuse third-party brand assets without authorization.
- Require human approval before final creative direction, render, and production deployment.
- Preserve prompt history and generated-asset provenance.
- Always run QA before deployment.
- Prefer strategy-first generation: positioning → direction → visuals → code.

## Marketplace Agents Added

- BrandForge Site Builder
- Brand Direction Analyst

## Next Implementation Stage

1. Add a dedicated `/brandforge` route.
2. Add backend endpoints for brand crawl jobs and brand kit storage.
3. Add Storybook persistence for brand kits, prompt packs, visual directions, and generated assets.
4. Add GitHub PR creation from approved generated components.
5. Add Vercel preview deployment tracking.
