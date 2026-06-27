# D3VONN Marketing Command Center Integration Guide

## What This PR Adds

- `/marketing` React route
- Navigation item for Marketing
- Reusable `MarketingCommandCenter` component
- Marketing API client
- Marketing domain types
- Supabase schema for campaigns, assets, reviews, and metrics
- FastAPI router stubs for Hermes-facing marketing operations
- Backend router registration under `/api/marketing/*`
- Marketing knowledge base and agent operating docs

## Frontend Route

The command center is available at:

```txt
/marketing
```

The route is lazy-loaded through `src/App.tsx` and linked from `src/components/navigation/navigationItems.ts`.

## Backend Router Wiring

The router stub lives at:

```txt
backend/app/routers/marketing.py
```

It is registered defensively in:

```txt
backend/app/routers/__init__.py
```

Mounted endpoints:

```txt
POST /api/marketing/generate
POST /api/marketing/rewrite
POST /api/marketing/brand-check
POST /api/marketing/claim-check
POST /api/marketing/approve
POST /api/marketing/prepare
POST /api/marketing/analyze
```

## Hermes Wiring Targets

Recommended Hermes routes:

```txt
generate_social_post
generate_email
generate_launch_campaign
brand_check
claim_check
prepare_channel_asset
analyze_campaign
```

## Database Tables

Migration:

```txt
supabase/migrations/20260626000001_marketing_command_center.sql
```

Tables:

- `marketing_campaigns`
- `marketing_assets`
- `marketing_reviews`
- `marketing_metrics`

## Security Model

- Row-level security is enabled.
- Campaigns/assets are owner-scoped to `auth.uid()`.
- Public channel movement remains human-approved.
- Claim-sensitive content must pass claim review.
- External posting/sending is intentionally not implemented in this PR.

## Next Implementation Steps

1. Replace deterministic endpoint stubs with Hermes agent calls.
2. Move hardcoded UI content into Supabase-backed campaign records.
3. Add admin/role gating if this route should be private.
4. Add real analytics ingestion into `marketing_metrics`.
5. Add optional scheduling adapters after approval workflow is stable.
