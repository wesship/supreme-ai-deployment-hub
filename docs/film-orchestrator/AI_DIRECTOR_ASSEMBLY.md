# D3VONN.IO AI Director / Movie Assembly

The AI Director converts candidate film clips into a continuity-aware edit plan and queued movie assembly job.

Pipeline:

1. Candidate clips + metadata enter `/api/ai-films/director/assemble`.
2. TwelveLabs/Jockey reasons across the certified film corpus and proposes sequence order, source ranges, transitions, continuity flags, missing coverage, and audio cues.
3. D3VONN.IO validates all asset IDs and source ranges and converts the plan into a deterministic record timeline.
4. A CMX-style EDL is generated for editorial interchange.
5. An `assembly` render job is queued in `ai_film_render_jobs` using the built-in `ffmpeg` provider contract.
6. Existing character-performance, voice, music, subtitle, and SFX outputs can be referenced as tracks by the assembly worker.
7. Final output is intended to pass TwelveLabs Analyze plus Jockey continuity QA before master export.

The planner fails safely: if Jockey is unavailable or returns unusable JSON, the system emits a conservative source-order cut rather than inventing clips or invalid time ranges.
