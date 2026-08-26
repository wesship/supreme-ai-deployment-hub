# Free Video Provider Catalog

Optional providers tracked by AI Films. This catalog is informational until an official API/worker path, automation permission, terms of service, watermark policy, and commercial-use rights are verified.

| Provider | Status | Capabilities | Production |
|---|---|---|---|
| Vibes AI (Meta) | unverified | text/image-to-video, start/end frames, audio/lip-sync reported | blocked |
| Symphony Creative Studio (TikTok) | manual_bridge | text/image/reference-to-video, frame controls reported | blocked |
| SnapGen AI | unverified | text/image-to-video, start frame, aspect ratio/resolution reported | blocked |
| Z Sky AI | unverified | text/image-to-video, first/last frame, audio reported | blocked |

## Activation policy

A provider may move to `api_ready` only after D3VONN verifies an authenticated server-side integration and records the applicable ToS/commercial-use and watermark findings. The provider must then be backed by a running worker and explicitly added to `AI_FILM_EXECUTABLE_VIDEO_PROVIDERS`.

Never place provider credentials in browser code, `VITE_*` variables, client storage, public tables, logs, or API responses.
