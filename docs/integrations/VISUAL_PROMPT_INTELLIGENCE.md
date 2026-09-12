# Visual Prompt Intelligence

D3VONN's visual prompt intelligence layer sits before image and video providers.
It converts loose creative intent into deterministic prompt fragments, constraints,
negative constraints, and metadata without coupling the orchestration layer to a
single generation vendor.

## Runtime flow

`Hermes / Brand Forge / AI Films -> VisualStyleLibrary -> provider router -> generator -> asset store`

The initial implementation lives in `backend/visual_intelligence/style_library.py`.
It provides:

- a small native D3VONN seed catalog;
- deterministic style lookup and search;
- provider-neutral prompt compilation;
- negative prompt compilation;
- metadata identifying compiler version and applied style.

## awesome-gpt-image-2

The public `freestylefly/awesome-gpt-image-2` project is an MIT-licensed prompt-as-code
catalog and is a candidate upstream source for additional style records and reusable
prompt patterns.

D3VONN should consume that project as an import/catalog source rather than copying its
website or binding production generation directly to its repository structure. Any
imported upstream content must preserve required MIT attribution and source metadata.

Recommended source marker:

`awesome-gpt-image-2:freestylefly/awesome-gpt-image-2@<commit>`

## Integration rules

1. Provider credentials remain server-side.
2. Style selection happens before provider routing.
3. User constraints override optional style guidance.
4. Imported styles retain source attribution.
5. Generation history should persist original prompt, compiled prompt, style ID,
   provider/model, output asset ID, and cost/usage metadata when available.
6. Provider-specific features belong in adapters, not in the style catalog.

## Next implementation gates

- Add a catalog importer for a pinned upstream commit.
- Add API endpoints for style search and prompt compilation.
- Feed compiled prompts into Brand Forge and AI Films generation packets.
- Persist generation records and resulting asset references in Supabase.
- Add quality scoring / regeneration policy after generation.
