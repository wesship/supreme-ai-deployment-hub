# Storybook Layer: Video Intelligence

## Purpose

The Video Intelligence Layer converts the uploaded `OKComputer_GenAI_Video_Startup_Report.zip` research artifact into a D3VONN.IO strategic knowledge layer for AI video production, OpenMontage positioning, competitor research, and marketplace agent planning.

## Seed Dataset

Source artifact:

- `GenAI_Video_Startups_Funding_Analysis_20260125.xlsx`
- `ai_video_companies_research.json`
- `genai_video_companies_research.json`

Initial encoded dataset location:

- `src/data/videoIntelligenceLayer.ts`

## Marketplace Agents

### OpenMontage Video Intelligence Studio

A production-facing agent that turns a video idea into:

- research brief
- script
- storyboard
- narration plan
- caption plan
- asset checklist
- render checklist
- publish checklist

It is designed to connect OpenMontage into the D3VONN.IO agent marketplace and Hermes orchestration path.

### Video Startup Analyst

A strategic intelligence agent that analyzes:

- GenAI video startups
- funding rounds
- valuation signals
- founder backgrounds
- investor patterns
- product categories
- D3VONN.IO market gaps
- partnership and acquisition opportunities

## Hermes Workflow Path

```text
Research → Script → Storyboard → Asset Plan → Voice/Narration → Render → Review → Publish
```

## Strategic Use Cases

- Position OpenMontage against Runway, Luma AI, Synthesia, HeyGen, Pika, Captions, Descript, and other AI video companies.
- Build a D3VONN.IO video production agent for Shorts, Reels, YouTube, product demos, launch trailers, and paid ads.
- Create an internal competitor dashboard for founder, investor, valuation, product, and category analysis.
- Turn uploaded Excel/JSON research into a living knowledge graph.

## Next Implementation Stage

1. Create a Video Intelligence dashboard route.
2. Add backend API endpoints for `/api/video-intelligence/companies`, `/api/video-intelligence/summary`, and `/api/video-intelligence/agents`.
3. Add ingestion from future Excel/JSON uploads.
4. Add Hermes job types for storyboard, render, review, and publish tasks.
5. Connect OpenMontage execution as an external provider.
