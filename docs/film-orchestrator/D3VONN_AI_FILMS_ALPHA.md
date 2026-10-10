# D3VONN AI Films Alpha

## Goal

Establish a self-hosted-capable AI filmmaking path for controlled short-form experiments while keeping local model execution disabled until the GPU worker acceptance gate is satisfied.

## Open/local model strategy

- **Wan 2.2**: candidate local video family for text-to-video, image-to-video, text+image-to-video, and animation-oriented workloads.
- **LTX**: candidate local video family for audio-video and general cinematic generation where the exact selected model/checkpoint terms permit the intended use.
- **ComfyUI**: optional operator-owned workflow runtime.
- **FFmpeg**: deterministic finishing/assembly runtime.

Model adapters remain interchangeable. Registry selection is metadata and routing only; it does not authorize model execution.

## Alpha flow

`idea -> screenplay -> film bible -> scenes -> shots -> gated local generation -> continuity QC -> audio -> edit -> FFmpeg -> final MP4`

## Film memory

Every generated asset should preserve:

- character/location/world references
- screenplay, scene, and shot metadata
- prompts and deterministic seeds where supported
- exact model/checkpoint identifier, revision, license record, and SHA-256
- runner/runtime revision
- parent/derived asset relationships
- QC and regeneration history
- final render provenance

## Self-hosted definition

A self-hosted path can avoid per-generation hosted API billing, but it is not unlimited or free. Capacity is constrained by GPU/VRAM, storage, electricity, runtime, maintenance, model/checkpoint licenses, and operational controls.

## Acceptance gates

1. Registry/routing tests pass while all local models remain execution-disabled by default.
2. The local GPU worker contract from the preceding gate is present and production execution remains off.
3. Host GPU identity/VRAM and CUDA/PyTorch compatibility are verified.
4. Exact model/checkpoint source revision, model revision, license, and SHA-256 are recorded.
5. One deterministic controlled shot completes successfully.
6. Output media is validated, hashed, and kept private until QC passes.
7. Retry/failure handling and queue idempotency are verified before dispatcher wiring.
8. Explicit release authorization is recorded before production generation is enabled.

## Production path

Only after those gates pass should D3VONN progress from one-shot validation to multi-shot shorts, episodes, and longer assemblies. Long-form output should use scene/shot continuation and editorial assembly rather than one monolithic generation request.
