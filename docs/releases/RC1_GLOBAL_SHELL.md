# D3VONN.IO RC1 Global Shell

## Brand contract

- Canonical company name: **D3VONN.IO**
- Canonical guardian: **EXU — Guardian of Infinite Intelligence**
- Canonical artwork: `/public/d3vonn-logo.webp`
- Canonical tagline: **One Platform. Infinite Intelligence.**
- The EXU winged-helmet image must not be redrawn, recolored, distorted, substituted, or cropped into a different mark.

## Shell contract

Public routes should migrate to `PublicPageShell`, which provides:

- enterprise header and desktop/mobile navigation through `Navbar`
- frozen EXU logo treatment
- accessible skip link
- route-aware breadcrumbs
- a stable main-content landmark
- global footer and CTA system
- keyboard-focus visibility
- compatibility with the repository's reduced-motion rules

## Migration pattern

```tsx
import { PublicPageShell } from '@/components/shell';

export default function ProductPage() {
  return (
    <PublicPageShell breadcrumbs={[{ label: 'Platform', to: '/platform' }, { label: 'Product' }]}>
      {/* page content */}
    </PublicPageShell>
  );
}
```

## Acceptance criteria

- Keyboard users can skip directly to main content.
- Breadcrumbs expose `aria-current=page` on the current route.
- Header and footer continue to use the immutable EXU asset.
- Mobile controls meet a 44px minimum target.
- Motion respects existing `prefers-reduced-motion` rules.
- Existing route behavior remains intact while product pages migrate incrementally.
