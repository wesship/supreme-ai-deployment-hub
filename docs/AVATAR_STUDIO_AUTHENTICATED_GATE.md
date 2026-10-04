# Avatar Studio authenticated handoff gate

This gate extends the canonical D3VONN API, not the standalone Studio reference server.
It does not deploy a GPU, activate paid providers or run Hermes. The existing public
`/avatar-studio` page retains its local manifest reader; saving metadata requires an explicit action.

## Implemented

- `GET /api/ai-films/avatar-studio/status`: resolve the bearer token with Supabase Auth;
  report handoff configuration and explicit false render/live/consent-verification flags.
- `GET /api/ai-films/avatar-studio/projects`: list the newest 50 projects owned by the caller.
- `POST /api/ai-films/avatar-studio/projects/{project_id}/handoffs`: persist only title,
  allowlisted format and four imported stage claims in an `ai_film_scenes` draft record.
  The source Studio project ID, scripts, objectives, blockers, jobs, consent and credentials are excluded.
  A server-computed SHA-256 binds the normalized metadata. Request UUID retries return
  the same draft; changed content with the same request UUID conflicts. Imported claims never confer approval.
- `POST /api/ai-films/avatar-studio/projects/{project_id}/render`: verify ownership then refuse
  with 503. No job is inserted, no worker is invoked and no provider credits are spent.
- `GET /api/ai-films/avatar-studio/projects/{project_id}/jobs/{job_id}/artifact`: read an existing
  completed/succeeded job owned by the caller, require its registered output asset in the same project,
  require matching asset `render_job_id` provenance, allowlisted private bucket and scoped object path,
  then ask Storage for a 60-second signed URL using the caller's JWT. This is output access,
  not publication approval or independent video-quality certification. Output without that provenance fails closed.

All Auth/Data API/Storage calls use the caller's token and existing publishable/anon key.
No service-role fallback, anonymous-account access, new tables or new RLS policies are introduced.
The UI clears connection, project and saved-result state on auth events and rejects late account responses.
It sends tokens only to verified canonical API origins, its own origin, or localhost in development.

## Verification

28 mocked backend boundary tests; 32 frontend tests including account-switch races and payload projection.
Production build and client credential scan pass. Full app type checking remains blocked only by the
pre-existing `HermesGovernancePanel.tsx` query for `hermes_runs`, absent from generated types.
Local native Chromium remains unavailable in this workspace; rendered browser verification is pending.
No authenticated live save, Storage signed-link request, GPU render or provider call was performed.

Read-only production catalog inspection confirmed the four reused tables exist with owner-scoped RLS
and both `ai-film-media` and `ai-film-renders` buckets are private. The existing scenes schema supports
the draft metadata record; no schema change is needed. This checks configuration, not multi-account live behavior.

## Activation and next certification

After merging and deploying this change into a review environment, set
`AI_FILMS_AVATAR_HANDOFF_ENABLED=true` on that environment only. Existing `SUPABASE_URL` and
`SUPABASE_ANON_KEY` are reused. The API must run the new router; a configured flag alone is insufficient.
Sign into D3VONN, import a Studio manifest, click Check authenticated connection, choose your owned
AI Film project, and click Save metadata as draft. Verify the persisted draft and repeated-request behavior.
Test a second account and a known stored output; inspect object expiry and Storage access denial.
Only then promote the handoff flag to production. No preview tokens are shared with Lovable or Academy.

The subsequent render gate requires authoritative consent records and revocation checks, version-bound
editorial approval, owned/materialized inputs, licensed GPU weights, a certified MuseTalk worker,
durable dispatch/claim/cancel/retry, output probing/storage and a real consented pilot render.
OpenAvatarChat live sessions and DLSS 5 remain unverified and disabled.
