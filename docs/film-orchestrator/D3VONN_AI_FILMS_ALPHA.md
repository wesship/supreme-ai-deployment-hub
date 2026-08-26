# D3VONN AI Films Alpha

## Goal

Deliver a self-hosted, quota-free AI filmmaking path for a 5-minute short film. The platform orchestrates planning, character/world continuity, shot generation, quality control, audio, editorial assembly, and final rendering.

## Open/local model strategy

- **Wan 2.2**: primary open video adapter for text-to-video, image-to-video, text+image-to-video, and character/animation workloads.
- **LTX**: audio/video adapter for synchronized audio-video and cinematic generation where its applicable model license permits the intended use.
- **ComfyUI**: optional workflow runtime for experimental pipelines.
- **FFmpeg**: deterministic finishing/assembly runtime.

Model adapters MUST remain interchangeable. The D3VONN film graph must not depend on one model provider.

## Alpha flow

`idea -> screenplay -> film bible -> scenes -> shots -> generation -> continuity QC -> audio -> edit -> FFmpeg -> final MP4`

## Film memory

Every film persists:

- characters and reference assets
- locations/world references
- props and wardrobe
- screenplay and scene metadata
- shot prompts, seeds, model/checkpoint and workflow versions
- generated assets and parent/derived relationships
- QC scores and regeneration history
- audio assets and editorial timeline
- final render provenance

## Unlimited/self-hosted definition

The self-hosted path has no per-generation API credit counter. Practical limits are GPU capacity, storage, electricity, runtime, and the license terms of each selected model/checkpoint.

## Alpha acceptance criteria

1. Create a film project from a single natural-language idea.
2. Produce a structured screenplay and scene plan.
3. Create persistent character and location records.
4. Generate at least one shot through a local model adapter.
5. Preserve parent/child asset provenance.
6. Run continuity QC and support retry/regeneration.
7. Assemble approved shots with FFmpeg.
8. Produce a playable MP4 and machine-readable manifest.
9. Record model/checkpoint/license metadata for every generated asset.
10. Keep external hosted video providers optional rather than required.

## Production path

After Alpha: 5-minute short -> 15-minute episode -> 30-minute production -> feature-length sequence orchestration.

Long-form generation should use scene/shot continuation and editorial assembly rather than attempting one monolithic generation call.
