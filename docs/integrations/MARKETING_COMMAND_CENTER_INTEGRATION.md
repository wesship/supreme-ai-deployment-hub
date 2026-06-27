# D3VONN Marketing Command Center Integration Guide

## What This PR Adds

- `/marketing` React route
- Navigation item for Marketing
- Reusable `MarketingCommandCenter` component
- Marketing API client
- Marketing domain types
- Supabase schema for campaigns, assets, reviews, and metrics
- FastAPI router stubs for Hermes-facing marketing operations
- Marketing knowledge base and agent operating docs

## Frontend Route

The command center is available at:

```txt
/marketing
```

## Backend Router Wiring

The router stub lives at:

```txt
backend/app/routers/marketing.py
```

To activate it, include it in the backend app registration layer where other routers are mounted:

```python
from backend.app.routers import marketing

app.include_router(marketing.router)
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

## Next Implementation Steps

1. Register `backend/app/routers/marketing.py` in the active FastAPI app.
2. Replace deterministic endpoint stubs with Hermes agent calls.
3. Move hardcoded UI content into Supabase-backed campaign records.
4. Add admin/role gating if this route should be private.
5. Add real analytics ingestion into `marketing_metrics`.
6. Add optional scheduling adapters after approval workflow is stable.
