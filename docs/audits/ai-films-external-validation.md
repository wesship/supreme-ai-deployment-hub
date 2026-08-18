# AI Films External Validation Evidence

## Production backend snapshot

On 2026-08-18, `https://api.d3vonn.io/health/deployment` reported production Railway revision `railway-ai-films-pollo-commerce-handoff-2026-08-10` at commit `489b641d6a56cc0cf39645def61ed800ef7572ed`. The endpoint reported all AI Films workers as stopped and the expected AI Films routes as unavailable. This establishes the release baseline for the backend registration and worker remediation.

## OpenAI video workflow

OpenAI’s current video-generation guide describes `POST /videos` as asynchronous. A caller may poll `GET /videos/{video_id}` until completion or receive `video.completed` / `video.failed` webhooks, then retrieve the MP4 from `GET /videos/{video_id}/content`. The guide supports `sora-2` and `sora-2-pro`, image references, and 4–20 second generations. The implementation uses the documented asynchronous submission, status retrieval, and content-download flow, storing completed media in private project storage before review.

Source: [OpenAI video generation guide](https://developers.openai.com/api/docs/guides/video-generation).

## Pollo callback workflow

Pollo’s official webhook guide defines the signed content as `${webhookId}.${webhookTimestamp}.${body}` and verifies it with an HMAC SHA-256 computed using the base64-decoded webhook secret. The existing commerce callback implementation follows this contract and retains Pollo as an optional callback-enabled route; the user-facing production route is constrained to OpenAI until a dedicated Pollo render worker is enabled.

Source: [Pollo AI API webhooks](https://docs.pollo.ai/webhooks).
