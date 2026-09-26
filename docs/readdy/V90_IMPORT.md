# Readdy V90 Homepage Presentation Import

**Status:** Homepage-only presentation transplant

**Target branch:** `feat/readdy-d3vonn-ui-transfer`

**Production reconciliation baseline:** `ce0560f` (original draft: `a6997e4`)

**Import date:** 2026-09-26

## Provenance

| Field | Value |
|---|---|
| Source project | Readdy project `dd3b402e-1da4-4fe4-954a-fad4fe9e7515` |
| Source label | `V90`, version `13627923` |
| Supplied archive SHA-256 | `4d4d1b0f9425ab88ce132aec727b722518ee2fe24f310c1c9e4320e126959e5d` |
| Source extraction | `/home/ubuntu/work/readdy-source/v90` (development workspace only; not shipped) |
| Source presentation files reviewed | `pages/home/page.tsx` and `pages/home/components/{Hero,SignalRail,Platform,Agents,Films,Infrastructure,Voice,Manifesto,FinalCTA,SignalField,Logo3D,Reveal,SectionHeader}.tsx` |

The V90 source is treated as **visual and marketing presentation only**. Its source `Navbar.tsx`, `Footer.tsx`, global `index.css` reset, `ThreeBackground.tsx`, source routes, source auth/Supabase files, form/newsletter endpoint, mock runtime updates, and source API-related code were deliberately excluded.

## Files and classification

| Path | Classification | Notes |
|---|---|---|
| `src/pages/Index.tsx` | **Canonical composition** | Retains the existing `<Helmet>` title/description/canonical values exactly, `HomepageShell`, public telemetry `AbortController` and fallback behavior, scroll progress, canonical `PlatformVideosSection`, and governed preview components. |
| `src/components/readdy/V90Homepage.tsx` | **Adapted V90 presentation** | React/TSX transplant of the V90 Hero, SignalRail, Platform, Agents, Films, Infrastructure, Voice, Manifesto, and FinalCTA section structures. It has no data writes, calls, auth, SDK, router setup, or backend authority. |
| `src/components/readdy/IconAdapter.tsx` | **Local presentation adapter** | Replaces all source Remix icon class names with installed `lucide-react` components. No icon-font CDN is used. |
| `src/styles/readdy-v90.css` | **Scoped visual adaptation** | Every custom rule is scoped to `.readdy-v90`; source palette values are literal CSS variables from source `tailwind.config.ts`. It imports no fonts, scripts, reset, root/body/html styles, or source global typography. |
| `public/readdy-v90/*` | **Original local V90 assets** | HTTP-downloaded from the URLs embedded in the supplied source components, validated by magic bytes and file type. They are served locally, never hotlinked. |

## Canonical authority retained

- The current app **Navbar** is explicitly rendered by `Index` because current-main `App.ShellChrome` suppresses it on `/`. `HomepageShell` supplies the canonical footer. Neither the source Navbar nor newsletter footer is imported.
- The existing `/api/public/stats` fetch, abort behavior, and response-field contract remain canonical. Missing values display `Not reported` or `Unknown`, never a fabricated operational state. Cumulative counts are labeled **Completed workflows** and **Tasks processed**, matching the existing API rather than claiming daily workflows or knowledge-node counts.
- Canonical `HomepageCTAGroup` and its session-aware `SmartLaunchLink` remain both primary homepage actions.
- The governed working integrations remain below the V90 visual layer: `PlatformVideosSection`, `HermesOrchestrationDemo`, `KnowledgeGraphPreview`, `MarketplacePreview`, and `TrustCenterPreview`.
- The V90 agent queue, infrastructure diagram, film frame chrome, platform map, and voice aperture are marked **illustrative**, **presentation**, or **reference** where they could otherwise be interpreted as live data.
- Voice is now a link to canonical `/voice-studio`; it never asks for microphone access and does not simulate a conversation.
- No source Supabase, authentication, backend/API, env, router, dependency, configuration, newsletter, or generated form code is imported.

## Navigation mapping

| Source target/intent | Canonical target used |
|---|---|
| `/command` / Command Core | `/occ` |
| `/agents` / AI Agents | `/ai-agents` |
| `/films` / AI Films | `/film` |
| Voice control | `/voice-studio` |
| Platform/infrastructure/creative surfaces | `/solutions` |
| Automation | `/business-automation` |
| Knowledge | `/dkos-ingestion` |
| Security/system status | `/security` |
| Primary launch action | Canonical `SmartLaunchLink` to `/app` or login redirect |

The `/occ` link explicitly says **admin sign-in required**. Its `AdminRoute` guard is unchanged; a marketing link does not grant operational access.

## Current-main reconciliation

The migration branch was fast-forwarded to `ce0560f` before transplanting the V90 homepage. This retains all intervening Hermes execution-plane repairs, release-policy changes, OAuth consent routing, and preview-session integration. Current-main title, description, Open Graph metadata, and canonical URL are preserved exactly.

Three pre-existing validation issues were repaired narrowly:

- `pnpm-lock.yaml` is synchronized with the existing current-main `package.json` (`@lovable.dev/mcp-js` and the already-requested Zod version). No package requirements were added or changed for V90.
- `voiceService.ts` gains local type-only Web Speech event declarations; emitted voice runtime behavior is unchanged.
- `previewAuthStorage.ts` uses a single-assignment `const` timer rather than a split `let` declaration, satisfying existing lint rules without changing session/storage behavior.

Hosted CI exposed two existing housekeeping defects: an unbounded Dependency Review comment exceeded the runner's environment-size limit, and the Deno job tried to save a pnpm cache it never populated. The transfer removes that oversized diagnostic environment value (the full review stays posted to the PR) and the unused cache input. Vulnerability/license enforcement, all Deno check steps, permissions, and production deployment controls remain unchanged. The new V90 tests also use single-pass DOM assertions so they pass under coverage without increasing test timeouts or weakening checks.

No backend code, API implementation, Supabase migration, router configuration, security header, or deployment workflow is changed by this transfer. Build-generated edits to tracked branding/Edge Function files are excluded from the commit.

## Asset manifest

All source URLs below are provenance only; the application uses the local public paths.

| Local file | Original source URL family | Type / dimensions | SHA-256 |
|---|---|---|---|
| `film-frame-01.jpg` | `https://readdy.ai/api/search-image?...seq=film-frame-01...` | JPEG, 1290×720 | `46b5dfe4eebbb685adf7a7ca4c9912ac72182e2e001c4ce66d02ee5eee9a0d01` |
| `film-frame-02.jpg` | `https://readdy.ai/api/search-image?...seq=film-frame-02...` | JPEG, 1290×720 | `75c0f61f8b8524dde2b764aade314ad9e03aee531784078f7d2e476581d7bceb` |
| `film-frame-03.jpg` | `https://readdy.ai/api/search-image?...seq=film-frame-03...` | JPEG, 1290×720 | `3dbaa4f25473918087feaa8bb83bcaadb249d418cd7f91faf90d00ad1b20ecd3` |
| `film-frame-04.jpg` | `https://readdy.ai/api/search-image?...seq=film-frame-04...` | JPEG, 1290×720 | `d24dd8d89a951fe3f5620f1fa5289fd3688a6d3dcd3bb631206d4807a871d200` |
| `film-frame-05.jpg` | `https://readdy.ai/api/search-image?...seq=film-frame-05...` | JPEG, 1290×720 | `38708211d3741ce0c11f3bd3cf128ae460439bfce44d21b828c35d0040ad610d` |
| `film-frame-06.jpg` | `https://readdy.ai/api/search-image?...seq=film-frame-06...` | JPEG, 1290×720 | `9bff4decda034c647e67aaf1ddf0c41d0b06ec719b8d9c7931189e931274cc1f` |
| `films-hero-frame.jpg` | `https://readdy.ai/api/search-image?...seq=films-hero-frame...` | JPEG, 1613×900 | `9d760a5808d9b599ea407a3afe62ec344e17b2b3ef794028580d4a85d8316810` |
| `manifesto-hands.jpg` | `https://readdy.ai/api/search-image?...seq=manifesto-hands...` | JPEG, 1000×1241 | `f700c4f3ed1a00232732396b570b51b49f83c57a5ddc52bc6344ed098986a96b` |
| `final-cta-emblem.webp` | `https://storage.helloreaddy.io/project_files/dd3b402e-1da4-4fe4-954a-fad4fe9e7515/91efb5dd-940b-4b12-9395-c334dc292df2_compressed_70B04E8F-3ED0-4BC1-981A-39D8961CE01D.webp` | WebP, validated | `97db456da7819b33e788a045c309b9527bd65af0dfce7b6cb1b1c0576d457eaf` |

The `film-frame-04` first GET response was incomplete; it was retried against the same original URL with HTTP GET and subsequently validated as an original JPEG. **No asset substitution was required.**

## Fidelity and accessibility adaptation notes

1. **ThreeBackground tradeoff:** source V90 uses `ThreeBackground.tsx`, which would require new `three` / `@react-three/fiber` dependencies and a heavy WebGL background. It is intentionally not imported. The source `SignalField` atmospheric grid, glow, signal sweep, and deterministic CSS particles are adapted as a lightweight CSS fallback.
2. **No invisible reveal gate:** the source `Reveal` starts content at `opacity: 0` until `IntersectionObserver` runs. The transplant deliberately starts all content visible, preventing inaccessible content if JS/animation observers fail.
3. **Motion:** V90 decorative animations are disabled under both `prefers-reduced-motion: reduce` and the current `html.reduce-motion` setting. No animation controls visibility.
4. **Typography:** source `Space Grotesk` and source external font/icon assumptions were not carried over. The transplant uses the repository’s available Inter and JetBrains Mono families.
5. **Images:** every imported image includes appropriate `width`, `height`, `alt`, `loading`, and `decoding`; the above-the-fold emblem is eager and all photographic content is lazy.

## Suggested validation

```bash
cd /home/ubuntu/work/supreme-ai-deployment-hub
pnpm exec tsc -p tsconfig.app.json --noEmit
pnpm exec eslint src/pages/Index.tsx src/components/readdy --ext .ts,.tsx
pnpm run build
rg -n "readdy.ai|helloreaddy|ri-" src/pages/Index.tsx src/components/readdy src/styles/readdy-v90.css
find public/readdy-v90 -type f -maxdepth 1 -exec file {} \;
git diff --check
```

Run the repository’s normal accessibility, responsive/mobile, Lighthouse, security, and required PR-gate checks in CI. This change does not alter Vercel configuration, dependencies, lockfiles, application routing, or any backend/auth/security authority.
