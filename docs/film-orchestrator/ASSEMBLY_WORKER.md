# AI Films Assembly Worker

The Railway production backend now contains two asynchronous AI Films workers.

## 1. FFmpeg assembly worker

Consumes `ai_film_render_jobs` where:

- `job_type = assembly`
- `provider = ffmpeg`
- `status = queued`

The worker atomically claims a job, resolves each timeline `asset_id` through
`ai_film_assets`, downloads server-readable media, normalizes resolution/FPS/audio,
applies deterministic cuts and dissolve/fade transitions, renders H.264/AAC MP4,
and uploads the master into the private `ai-film-renders` Supabase Storage bucket.

Private Google Drive share links are never handed to FFmpeg. Jobs containing a
Drive asset without a server-readable materialized path become `blocked` with a
retryable `materialization_required` reason.

## 2. Post-render QA worker

Completed masters enter `pending_post_render_qa`. The QA worker:

1. creates a short-lived private Storage signed URL;
2. creates a TwelveLabs asset for the finished master;
3. runs Pegasus Analyze for edit/continuity/audio/pacing review;
4. adds the master to the canonical Jockey knowledge store;
5. waits for the item to become ready;
6. runs Jockey corpus-aware picture-lock QA;
7. persists provider IDs and assessments on the render job output.

A QA failure does not delete or mark a successfully rendered master as failed;
its QA state is recorded separately and remains retryable.

## Runtime controls

- `AI_FILM_ASSEMBLY_WORKER_ENABLED` (default `true`)
- `AI_FILM_ASSEMBLY_POLL_SECONDS` (default `8`)
- `AI_FILM_ASSEMBLY_QA_ENABLED` (default `true`)
- `AI_FILM_ASSEMBLY_QA_POLL_SECONDS` (default `15`)
- `AI_FILM_RENDER_BUCKET` (default `ai-film-renders`)

The Railway image installs both `ffmpeg` and `ffprobe`.
