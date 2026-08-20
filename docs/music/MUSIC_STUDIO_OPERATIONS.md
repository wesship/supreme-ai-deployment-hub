# D3VONN Music Studio Operations

**Status:** engineering foundation complete; hosted dispatch remains deliberately disabled until the provider-policy and GPU integration gates are closed.

> **Working compliance note:** this document is an engineering control plan, not legal advice. Confirm the selected code, model-weight, dataset, output, distribution, and deployment terms with qualified counsel before enabling a commercial hosted service.

The Music Studio is intentionally split into four concerns. The React interface collects the request and displays its durable state. The `music-generate` Edge Function validates the request, enforces policy and quotas, and stores an auditable job. A protected operations cycle claims and dispatches jobs through a provider adapter. Finally, the private backend performs validation, loudness analysis, silence detection, metadata extraction, and optional mastering before the result enters the private library.

| Component | Responsibility | Security boundary |
| --- | --- | --- |
| `src/pages/Music.tsx` | Authoring interface, provider-policy status, job visibility, cancellation, demo audio | Browser has no provider secret or direct provider URL. |
| `supabase/functions/music-generate` | Provider selection, policy gate, quota checks, job lifecycle, adapter calls, signed storage URLs | Stores all provider and service credentials as function secrets. |
| `backend/music/audio_qa.py` | Validates media, runs FFmpeg loudness and silence analysis, creates mastered output | Requires the `X-Music-QA-Token` service-to-service header. |
| `music-library` storage bucket | Stores source artifact, mastered artifact, artwork, and provenance by user/job prefix | Private bucket; the UI receives time-limited signed URLs only. |
| Provider deployment | ACE-Step REST service on port 8001 | Must be private, authenticated, and reachable only through an approved connector. |

## Provider policy control

A job cannot be created until an enabled provider profile simultaneously has `license_review_status = approved`, `commercial_allowed = true`, `hosted_allowed = true`, and `output_commercial_allowed = true`. This gate separates technical readiness from release authorization. Each submitted job stores a license snapshot, provider/model version, request fingerprint, seed when returned, and provenance data so later policy changes do not erase historical context.

The official ACE-Step 1.5 source currently labels its code and model card as MIT licensed, and its model card says generated music can be used commercially. Its repository also documents a REST API, 10–600 second generation range, `/v1/stats`, `/v1/models`, and `/health` endpoints. These facts conflict with the pasted review’s statement that the current upstream version has an anti-SaaS restriction. The code therefore retains a **pending, denied-by-default** profile until the team confirms the exact code revision, model weights, and any other applicable terms.

| Provider profile field | Why it exists | Default for `ace-step-1.5` |
| --- | --- | --- |
| `technical_status` | Separates runtime reachability from legal suitability. | `unknown` until a probe completes. |
| `license_review_status` | Requires an accountable review record. | `pending`. |
| `commercial_allowed` | Controls commercial service dispatch. | `false`. |
| `hosted_allowed` | Controls hosted/API use. | `false`. |
| `output_commercial_allowed` | Controls rights assertion for generated output. | `false`. |
| `attribution_requirements` and `provenance_requirements` | Keeps release-facing requirements close to the selected provider. | Stores MIT-notice and audit recommendations. |

After written approval, make a controlled, reviewed update to the provider profile rather than changing code:

```sql
update public.music_provider_profiles
set
  license_review_status = 'approved',
  commercial_allowed = true,
  hosted_allowed = true,
  output_commercial_allowed = true,
  notes = 'Approved by <owner> on <date>; record decision reference here.'
where provider_key = 'ace-step-1.5';
```

Do not run this statement based solely on this document. It is the production-release gate.

## Job lifecycle and safety controls

The lifecycle is durable and strictly transition-checked in PostgreSQL.

| Stage | Meaning | Key persisted data |
| --- | --- | --- |
| `queued` | Authenticated request accepted; no provider call yet. | Prompt, normalized controls, policy snapshot, idempotency key. |
| `provisioning` | Worker atomically claimed the job. | Attempt count and provisioning timestamp. |
| `running` | Provider returned its task ID. | Provider task ID and submission latency. |
| `post_processing` | Provider audio is ready and is being validated. | Transition event and timestamp. |
| `uploading` | Original and mastered files are being written to private storage. | Transition event and timestamp. |
| `succeeded` | Private library record complete. | Original/processed paths, QA result, metadata, provenance, signed URL. |
| `failed`, `cancelled`, `retrying` | Terminal or controlled recovery states. | Failure reason, message, event history, attempt count. |

The Edge Function applies a concurrent-job limit of **2 per user**, a monthly limit of **100 per user**, 10–600-second durations, 40–240 BPM, prompt and lyric limits, idempotency support, cancellation, active-job queue visibility, and safety-event logging. The PostgreSQL claim function uses `FOR UPDATE SKIP LOCKED`, so overlapping worker cycles cannot submit the same job twice.

## Required secrets and service settings

Store these as Supabase function secrets or backend service configuration, never in source control.

| Setting | Used by | Purpose |
| --- | --- | --- |
| `ACESTEP_API_URL` | Edge Function | Authenticated, private connector address for ACE-Step; no public IP endpoint. |
| `ACESTEP_API_KEY` | Edge Function and provider | Shared provider bearer token. |
| `MUSIC_AUDIO_QA_URL` | Edge Function | Private URL for `POST /api/music/audio-qa`. If unset, the job uses basic validation only and records that fact. |
| `MUSIC_AUDIO_QA_TOKEN` | Edge Function and backend | Service-to-service authentication for audio QA. |
| `MUSIC_OPS_TOKEN` | Operations scheduler and Edge Function | Authenticates `probe` and `dispatch`; do not expose to browsers. |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function only | Server-side database and private-storage operations. |

The edge operation calls are as follows. The first and second must originate from a protected scheduler or operator process, not from client code.

```bash
# Record GPU/API model and queue health after the provider is reachable.
curl -X POST "$MUSIC_FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "X-Music-Ops-Token: $MUSIC_OPS_TOKEN" \
  --data '{"action":"probe","provider":"ace-step-1.5"}'

# Claim queued/retrying jobs, submit them, and reconcile running jobs.
curl -X POST "$MUSIC_FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "X-Music-Ops-Token: $MUSIC_OPS_TOKEN" \
  --data '{"action":"dispatch","limit":5}'
```

Run the dispatch operation at a cadence appropriate to latency requirements, such as every 30–60 seconds, using an authenticated background scheduler. It should not run through browser polling or a full interactive agent session. Add a single-instance lock at the scheduler layer if the platform might launch more than one scheduler simultaneously; database claims already protect individual jobs.

## Local GPU integration

`deployment/music/docker-compose.local-gpu.yml` follows the upstream ACE-Step generic CUDA container contract. It binds the API to `127.0.0.1:8001`, uses `ACESTEP_MODE=api`, requests an NVIDIA GPU, persists checkpoints and generated output, and has a health check against `/health`. The checked-in `.env.local-gpu.example` contains no secret values.

A local GPU must remain invisible to the public Internet. Connect it through a private network or an approved authenticated connector that terminates TLS and forwards to the loopback API. Point `ACESTEP_API_URL` at that connector endpoint only after a health probe succeeds. The upstream project separately publishes a Jetson image and compose path; use that upstream Jetson configuration on Orin hardware rather than the generic x86 CUDA manifest.

## Cloud GPU integration

`deployment/music/kubernetes/ace-step-private-gpu.yaml` is a deliberately inactive deployment template. It includes persistent model and output volumes, private `ClusterIP` service exposure, NVIDIA GPU requests, probes, and an optional KEDA scale-to-zero object. It starts at `replicas: 0` and has no `Ingress`, so applying it cannot accidentally expose a model endpoint.

Before increasing replicas, replace the invalid image reference, create the secret, confirm the GPU class/model memory profile, pre-warm model volumes, confirm private connector routing, run the health probe, generate a test song, run audio QA, and verify the private library record. Apply the KEDA object only after the named Prometheus metric actually exists; otherwise an autoscaler can silently fail to wake the GPU.

## Release checklist

| Gate | Evidence required | Status after this change |
| --- | --- | --- |
| UI and CC0 demo audio | Music Studio routes and preview cards render. | Ready for validation. |
| Database and private storage | Migration applied successfully; RLS and bucket policies verified. | Migration prepared, not applied. |
| Provider abstraction | Provider profile, adapter key, and policy gate work. | Implemented. |
| Job orchestration | Lifecycle triggers, events, idempotency, claim RPC, scheduler dispatch verified. | Implemented; scheduler must be configured. |
| GPU health | Private provider returns `/health`, `/v1/models`, and `/v1/stats`. | Probe implemented; GPU not connected. |
| Audio QA | Backend has FFmpeg and `MUSIC_AUDIO_QA_URL`/token configured. | Implemented; service must be deployed. |
| Local/cloud GPU | Private connector, persistent storage, smoke generation, model download verified. | Definitions prepared; not provisioned. |
| Provider approval | Exact deployment/materials terms reviewed and approved by the accountable owner. | **Blocked by design.** |
| Production launch | All preceding gates passed and operational monitoring is active. | **Blocked.** |

## References

[1] [ACE-Step 1.5 repository and installation guidance](https://github.com/ace-step/ACE-Step-1.5)

[2] [ACE-Step 1.5 MIT license text](https://github.com/ace-step/ACE-Step-1.5/blob/main/LICENSE)

[3] [ACE-Step 1.5 model card](https://huggingface.co/ACE-Step/Ace-Step1.5)

[4] [ACE-Step 1.5 REST API documentation](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/API.md)
