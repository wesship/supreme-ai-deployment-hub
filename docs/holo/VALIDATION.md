# Validation and release status

Base commit: 071dc4919ac1af51f1f20f1c0a1b42204fe0a13f.

The implementation was rebuilt after a transient workspace reset interrupted publication. Model/runtime bytes match the original reference, and their hashes are pinned in ASSETS.sha256. User explicitly authorized repository publication and deployment after checks pass.

Reconstructed acceptance suite has 27 tests covering geometry, identity, pinch hysteresis, held commands, camera cancellation/lifecycle/retry/disconnection, explicit device selection, fullscreen/discovery, navigation, private note import and scoped policies. Current results are being rerun before release.

The canonical release gate includes frontend lint/tests/coverage/dependency audit/build and backend tests/security/workflow checks. Production deployment is conditional on those checks. The local runtime is Node 24, while the repository expects Node 22; CI supplies Node 22.

An explicit app TypeScript check additionally exposes three existing baseline diagnostics: HermesGovernancePanel references hermes_runs absent from the generated Supabase type; KnowledgeGraphOS nav union lacks optional active; activity timestamp has an unknown type. These were confirmed on the unchanged base in the original validation. No weakening of type/security gates is intended.

Open acceptance: physical one/two-hand accuracy on a WebGL-2-enabled camera, actual XREAL display, signed-in voice-provider session, and deployed MIME/headers/asset checks. The earlier headless browser lacked WebGL 2; no successful physical hand inference is claimed. Existing auth boundaries must remain intact.
