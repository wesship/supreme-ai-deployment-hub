# D3VONN hand workspace

Route `/holo`, with `?display=xreal` for display glasses. The homepage HANDS link loads a new document to obtain the route-specific camera/WASM policy. Exit links reload the destination document to restore its policy.

Camera starts only by explicit user action, processes locally with self-hosted MediaPipe, and stops on tab hiding, unmount, camera disconnection or user stop. It requires WebGL 2, even when the delegate falls back to CPU. No CDN fallback or frame upload. An unsupported device receives an actionable error and its stream is released.

Pinch drag, quick pinch selection, two-hand zoom/pan/rotation, held peace reset and held two open palms arrange. Stable nearest-palm identity, ghost deduplication, finite input validation, pinch earn/debounce and hysteresis reduce accidental gestures. Pointer, touch and keyboard selection remain available.

Six cards link to canonical D3VONN tools: Hermes workflows, knowledge graph, agents, Film Studio, Voice Studio and mission control. Existing protected routes retain authentication. Gestures never execute backend tasks directly.

Local `.txt`/`.md` import uses plain text, at most 20 notes and 64 KB each. Notes live only in component memory and are excluded from the existing Hermes voice-session context. Read aloud accepts only installed local English voices. Voice tools retain the canonical session, auth and orchestration component.

Fullscreen uses the browser API. Camera selection requests an exact device ID, audio:false. Changing camera/mirroring stops tracking before applying new coordinates. Camera enumeration is explicit. Preview is off by default.

XREAL mode is a display layout. Connect through a USB-C DisplayPort-capable host, use OS extend/mirror, move the window, and enter fullscreen. This does not pair native glasses sensors or claim 6DoF/spatial anchoring. Native XREAL integration requires a separate supported SDK/device implementation.

Original Holo Gestures reference: https://github.com/zubair-trabzada/holo-gestures at 55626ff00f6b49c649a407ffdb3cad174479c637. MIT attribution retained. MediaPipe model/runtime are vendored with Apache-2.0 notice and SHA-256 manifest. CSP blocks upstream diagnostic telemetry.
