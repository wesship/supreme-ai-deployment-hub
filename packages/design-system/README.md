# @d3vonn/design-system

Canonical UI foundation for D3VONN.IO v2.0 RC1.

## Frozen identity

- Brand: **D3VONN.IO**
- Guardian: **EXU**
- Guardian title: **Guardian of Infinite Intelligence**
- Master artwork: `/public/d3vonn-logo.webp`
- Tagline: **One Platform. Infinite Intelligence.**

The master winged-helmet artwork is immutable. Components may resize or responsively crop it, but must not redraw, recolor, replace, distort, or separate EXU from the approved composition when the master logo is required.

## Package surface

- `D3VONN_BRAND` — canonical brand contract
- `tokens` — colors, spacing, radii, shadows, motion, and typography
- `PageShell` — accessible page root with skip navigation
- `Section` — consistent public-page section structure
- `Surface` — glass, carbon, and chrome content surfaces
- `Action` — accessible shared CTA primitive

## RC1 migration rule

New and migrated pages must consume these primitives or approved extensions. One-off replacements require an architecture/design decision record.
