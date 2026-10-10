# D3VONN.IO presentation and runtime authority

The production frontend is `wesship/supreme-ai-deployment-hub`. The public root renders `src/pages/Index.tsx` → `src/components/sovereign/SovereignSignalHomepage.tsx`. `/knowledge-graph` retains its repository-native experience. Readdy is a presentation reference, not the production application shell.

Keep authentication, API calls, Hermes execution, protected routes, Supabase policies, security, voice orchestration and deployment configuration repository-native. Do not wholesale-replace `src/App.tsx` with generated source or import generated backend/schema code.

## Export handoff, 2026-10-09

The supplied `project-14687484.zip` is valid React/TypeScript source. Its homepage launch CTAs used local section anchors and several generated operational routes differed from production. The corrected standalone handoff now uses ordinary browser links to `https://www.d3vonn.io`:

| Export destination | Canonical destination |
| --- | --- |
| Launch / Enter the Platform | `/app` |
| `/command` | `/command-center` |
| `/films` | `/ai-films` |
| `/studio` | `/music` |
| Sound Lab | `/voice-studio` (Voice Studio) |
| `/blog` | `/resources` |
| `/admin` | `/occ` |

Existing matching destinations use their canonical routes. Exploration anchors remain local. The exported Logo3D feathering, tilt, sheen, reflection, ripples and SignalField effects remain intact.

The export's custom Supabase lock incorrectly returned a release callback and never invoked the supplied auth operation. The corrected reference uses SDK default locking. Music segment controls explicitly declare their value types. These generated modules are reference-only and are not imported into production. `export-fixes.patch` records all eight changed source files relative to the supplied ZIP. Original environment values are excluded from the downloadable handoff.

The corrected export passes `npm run type-check` and `npm run build`. Its bundle-size/config-loader warnings remain advisory. This does not certify its generated standalone backend, newsletter endpoint or authenticated workflows.

## Repository presentation corrections

The canonical homepage retains its neural web, orbit, globe, card and signal effects. The handoff adds soft-edge logo/card masks, working mobile navigation with keyboard dismissal, and the missing platform anchor. The mobile card uses the original locally stored enterprise artwork, explicitly labeled as a concept visualization; its illustration is not live telemetry. The public telemetry panel retains real values/fallbacks. The header uses the generated WebP directly because an SVG image referencing another image does not render reliably inside an img element. Readiness labels identify surfaces; core status comes from telemetry.

Production release uses the existing `supreme-ai-deployment-hub` Vercel project and its bound D3VONN.IO domains. Keep changes behind the repository's required PR gate and verify the actual deployed frontend commit, routes and rendered mobile navigation after release. Backend runtime identity alone does not prove the frontend release.

## Dependency release gate

The 2026-10-09 release check identified three high-severity advisories in the existing dependency graph. The release pins `source-map-js` to 1.2.2, `sharp` to 0.35.5 and `@modelcontextprotocol/sdk` to 1.31.0, with a regenerated frozen lockfile. Re-run the high-severity audit and complete the canonical gate on the resulting commit.

A separate moderate advisory, GHSA-hp3w-g68c-fv3c, affects `sprintf-js` 1.1.3 through Transformers → onnxruntime-node → global-agent → roarr. The advisory lists no patched release. It is retained as an explicit unresolved upstream finding; the release gate is not weakened or suppressed. The browser homepage does not call this Node logger. Do not describe the entire dependency graph as vulnerability-free.
