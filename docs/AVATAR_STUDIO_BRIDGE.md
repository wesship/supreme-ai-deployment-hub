# Avatar Studio bridge

The local manifest importer validates Studio version-1 workflow JSON and retains only metadata in page memory. Scripts, objectives, directions and job IDs are discarded. Imported statuses are explicitly unverified file claims and cannot trigger Hermes execution.

An optional authenticated handoff now lets a signed-in D3VONN user explicitly save title, format and stage claims as a draft in an owned AI Film project. It is disabled until the backend handoff flag is enabled. See [the authenticated gate](AVATAR_STUDIO_AUTHENTICATED_GATE.md) for routes, retry behavior, private output access and deployment certification. This does not make imported approvals or render claims authoritative.

The canonical D3VONN frontend remains this repository. `/avatar-studio` adds a use-case catalog reachable from Neural Nexus navigation, AI Films, the protected Film Studio, and Workflows. Existing authentication, Hermes APIs and route guards remain unchanged.

The current external authoring target is a Lovable **preview**, not a verified public production domain. `src/features/avatar-studio/catalog.ts` fixes the target origin. A launch opens `/projects?template=<allowlisted format>`; Studio must preselect its new-project format without automatic creation. No names, scripts, tokens, media or credentials are forwarded. Separate origins keep separate sessions; this does not add SSO.

## Supported workflows

News anchor/HNF bulletin, podcast host, interviews, video presenter/onboarding, HNF Academy teacher, instructor demonstration, cinematic scene. Workflow brief downloads are custom version-1 `d3vonn.avatar-workflow-brief` planning JSON. They always start at draft and explicitly mark execution disconnected. They must not be submitted to the current Hermes engine as executable definitions.

## Academy handoff

Studio exports `d3vonn.hnf-academy.lesson-package`, packageVersion 1. Academy `/studio-lessons` reads the user-selected file locally and projects only teaching content. Review the objectives, sections, segment text and knowledge checks. Saving a local draft does not publish an LMS course. This is not an H5P package.

## Remaining runtime contracts

Authenticated Hermes execution, render-worker deployment, verified Studio public URL, LMS publication and cross-app SSO require their own verified integration. DLSS 5 remains unverified; hardware/plugin compatibility must come from an actual worker report. A public link cannot activate rendering.

## Validation

Focused catalog tests cover exact target/query, invalid input and planning-only output. Run `pnpm exec vitest run src/features/avatar-studio/catalog.test.ts`, `pnpm exec tsc --noEmit`, and `pnpm build` with repository Node 22 / pnpm 9.15.9.

## News anchor integration

The `news_anchor` launch is a sourced bulletin preparation workflow. The Studio renderer implementation and deployment readiness are separate from this public frontend. No provider credentials, original likeness media, or script content is sent through the launch URL.

Recommended components:
- MuseTalk 1.5: https://github.com/TMElyralab/MuseTalk — lip-sync worker. Code MIT; its README permits trained models for commercial use, with dependencies checked independently. Upstream sample/test media is not part of the commercial handoff.
- RetroCast: https://github.com/ppv999/retrocast — MIT news/audio workflow reference. Firecrawl/OpenAI/ElevenLabs are external services with their own credentials and terms. Do not copy vintage broadcaster branding, bundled music or voices into D3VONN releases.
- OpenAvatarChat: https://github.com/HumanAIGC-Engineering/OpenAvatarChat — Apache-2.0 framework reference for future live sessions. Each selected model has separate terms and hardware requirements. Hermes remains the orchestrator; no OpenClaw dependency is needed.

The first pilot is a project-authored, editable example about Studio, not a fabricated current-news report. Editorial approval, dated evidence, consent and media-rights review precede rendering. A source-search cross-check is supporting evidence, not a guarantee of factual accuracy. News exports should not be treated as HNF Academy teaching packages.

GPU/model execution, voice output and live conversation have not been verified by this bridge. Benchmark likeness preservation and caption/audio synchronization using the user's approved media before enabling them.
