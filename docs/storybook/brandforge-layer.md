# Storybook Layer: BrandForge

## Purpose

BrandForge is the D3VONN.IO brand-to-site production layer. It converts approved brand inputs into a strategy-backed landing page, website refresh, campaign page, visuals, motion assets, GitHub pull request, and Vercel deployment path.

The goal is not just to generate a website quickly. The goal is to prevent generic AI output by forcing brand strategy, positioning, creative direction, asset provenance, and human approval before final deployment.

## Core Workflow

```text
Brand Crawl → Brand Kit → Creative Direction → Visual Generation → Motion Assembly → Site Build → QA → GitHub/Vercel Deploy
```

## Agent Roles

### Firecrawl Research Agent

Extracts public information from approved URLs:

- brand copy
- page hierarchy
- product/service descriptions
- screenshots
- logo references
- color clues
- CTA language
- offer structure
- social proof
- competitor references

### Brand Strategist Agent

Turns crawl output into a brand system:

- positioning statement
- primary audience
- offer clarity
- voice/tone
- value props
- CTA strategy
- proof points
- design constraints

### Creative Director Agent

Creates the visual and motion direction:

- hero concepts
- page mood
- section hierarchy
- prompt packs
- visual guardrails
- motion language
- thumbnail/social variants

### Nano Banana Visual Agent

Generates brand-aligned visuals:

- hero images
- social thumbnails
- brand graphics
- product mockups
- campaign images
- visual transition frames

### OpenMontage Video Agent

Creates motion/video assets:

- hero transition videos
- product trailers
- launch clips
- short-form social videos
- captions and render plans

### Claude Code Builder Agent

Builds the site:

- React page structure
- responsive sections
- reusable components
- improved HTML/layouts
- conversion-focused copy placement
- deployment-ready GitHub changes

### QA Guardian Agent

Checks before release:

- brand consistency
- accessibility
- responsive layout
- SEO metadata
- links and CTAs
- performance risk
- legal/asset usage risk

### Deployment Agent

Creates delivery artifacts:

- GitHub branch
- pull request
- Vercel preview
- release notes
- production handoff checklist

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
