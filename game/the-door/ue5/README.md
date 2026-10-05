# The Door — Unreal Engine 5.3 Gate 107

This path is reserved for the reconstructed `DEVONN_AI` Unreal project used to obtain the first authoritative UE 5.3 compiler/runtime evidence for Gate 107.

Status: source scaffold is prepared and statically audited, but **Gate 107 is not GREEN until UnrealHeaderTool/C++/link/editor/runtime/package evidence is captured**.

Execution order:

1. Generate project files.
2. Build `DEVONN_AIEditor Win64 Development`.
3. Fix only the first actionable UHT/C++/linker blocker and rebuild.
4. Run `TheDoor.Retro` automation tests.
5. Boot the editor, run PIE, and exercise the Retro runtime smoke actor.
6. Save, quit, cold-restart, and verify persisted Retro state.
7. Cook/package and test the packaged build offline.

Project invariant: the core game must remain playable offline and must not depend on Hermes, GODMOD3, external LLMs, or optional D3VONN.IO services.
