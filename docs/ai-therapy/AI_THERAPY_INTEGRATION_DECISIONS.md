# AI Therapy integration decisions

Status: APPROVED FOR ENGINEERING / PRODUCTION REMAINS BLOCKED

This document records the integration policy for D3VONN AI Therapy. It does not certify the product for clinical or production use.

## Authoritative architecture

All conversational, screening, journaling, memory, voice, and tool flows remain behind the D3VONN Safety Kernel and output/tool safety boundary. No third-party model or assessment package may bypass those controls.

Required order:

User input -> identity/consent -> input Safety Kernel -> optional structured screening/context -> approved model/agent -> output/tool safety checks -> supportive response OR human escalation

## MindLogger

Use MindLogger as a design reference for structured assessments, longitudinal check-ins, journaling, research workflows, and participant data collection. Do not vendor or copy MindLogger source code into D3VONN without a separate license review. Current repositories include CPAL-1.0 and DOSA-1.0 licensing rather than a simple MIT/Apache dependency profile.

Preferred approach: independently implement the needed D3VONN workflows and keep MindLogger out of the runtime dependency graph.

## Screening boundary

Support validated screening instruments only as structured assessments. Screening results must not automatically become diagnoses, treatment plans, medication advice, or autonomous clinical decisions.

The screening layer must identify the instrument/version/source, preserve scoring provenance, distinguish raw answers from derived scores, keep user-facing language explicitly non-diagnostic, route safety-significant answers through the Safety Kernel, support audit/export/retention/deletion controls, and require a current terms review before questionnaire text is embedded in a commercial build.

Initial candidates are PHQ-family and GAD-family instruments after terms verification. Until that review is complete, production questionnaire text remains disabled.

## Model policy

Public mental-health or counseling fine-tunes may be evaluated offline or in shadow mode, but they are not trusted as safety classifiers, clinical authorities, or unrestricted production agents.

A model may enter the approved-model registry only after pinned versioning, multi-turn safety evaluation, dependency-boundary evaluation, provider-outage testing, privacy/security review, red-team review, and appropriate human safety review.

## Evaluation priority

Prioritize multi-turn mental-health safety evaluation over adding more therapist-style models. Adapt ideas from current clinical AI red-teaming and interaction-level safety research, but do not ingest external datasets or benchmarks until their license, privacy, intended-use, and provenance are reviewed.

Internal evaluation categories should include crisis escalation, harmful belief reinforcement, dependency/manipulation, inappropriate clinical claims, boundary violations, unsafe action proposals, multi-turn risk accumulation, outage behavior, voice/text parity, privacy/tenant isolation, and kill-switch/rollback behavior.

## Native journaling and longitudinal context

Build a native D3VONN journaling/check-in module rather than importing a third-party mental-health application. It should support user-authored entries, optional structured mood/check-in fields, longitudinal trend summaries, explicit consent for memory use, least-privilege storage, tenant isolation, export/delete, and minimized sensitive telemetry.

Longitudinal summaries are contextual support only and must not be presented as diagnosis or clinical certainty.

## Production posture

Production remains OFF until the AI Therapy safety case is certified. This policy does not alter the blocked capability manifest, shadow evidence gate, red-team requirement, human safety review requirement, privacy/tenant-isolation requirement, voice-parity requirement, or kill-switch requirement.
