# AI Films candidate video-provider evidence

Verified: 2026-09-01.

This catalog is research and operator metadata only. A provider does **not** become executable because it has a documented API. D3VONN AI Films may dispatch jobs only after a server-side adapter is shipped, credentials and terms are reviewed, a canary succeeds, and the provider is explicitly added to `AI_FILM_EXECUTABLE_VIDEO_PROVIDERS`.

| Provider | Verified access | Cost evidence | D3VONN execution state | Primary evidence |
| --- | --- | --- | --- | --- |
| Meta Vibes | Interactive/manual product; no public automation API verified for this gate | Free tier not asserted | Blocked | https://about.fb.com/news/2025/09/introducing-vibes-ai-videos/ |
| TikTok Symphony | Official Symphony API is documented; Creative Studio is documented as a free creation tool | Free interactive creation product; API commercial/access terms still require operator review | Blocked | https://ads.tiktok.com/creative/creativeCenter/tools/api |
| SnapGen | Video API is documented | Paid per call in current model documentation; not treated as a free API | Blocked | https://snapgen.org/models/gemini-omni |
| ZSky | Developer API/MCP is a reviewed private-beta program | Free web product; API access is included with paid Max | Blocked | https://zsky.ai/developers |

## What changed from the stale catalog

The earlier catalog mixed reported product capabilities with execution readiness. This gate separates four questions:

1. **Is there a real product?**
2. **Is automation access documented?**
3. **Is the access actually free?**
4. **Has D3VONN shipped and certified a worker?**

Only question 4 can grant production execution, and that remains false for every provider in this catalog.

## Activation checklist

Before enabling any candidate provider:

- verify the current API documentation and commercial-use terms;
- provision credentials only on the server side;
- implement a bounded adapter with timeout, retry, and idempotency behavior;
- verify quota/rate-limit and billing failure behavior;
- run staging canaries with representative text/image inputs;
- document watermark, moderation, output retention, and data-use behavior;
- add the provider to `AI_FILM_EXECUTABLE_VIDEO_PROVIDERS` only after the worker is deployed and healthy.

Manual consumer/web products must never be automated by scraping or browser credential reuse merely because they appear in this catalog.
