# D3VONN.IO Homepage QA Checklist

Use this checklist after the showcase sections are wired into the homepage and deployed.

## Lighthouse targets

- Performance: 95+
- Accessibility: 95+
- Best Practices: 100
- SEO: 100

## Responsive QA

Validate these viewports:

- Mobile: 360x800
- Mobile large: 430x932
- Tablet: 768x1024
- Laptop: 1366x768
- Desktop: 1920x1080

## Browser QA

- Chrome
- Edge
- Safari
- Firefox

## Homepage smoke tests

- Homepage renders without crashing.
- Hero logo loads.
- Public telemetry falls back gracefully if `/api/public/stats` is unavailable.
- Knowledge Graph links route correctly.
- Hermes demo controls work.
- AI Workforce cards render on mobile and desktop.
- Use-case carousel switches active cards.
- Movie Studio CTA routes to `/film`.
- Security/trust CTAs route correctly.
- No private admin/OCC endpoints are called from public homepage code.
- No console errors from missing assets.

## Accessibility checks

- Keyboard focus states are visible.
- Buttons are real `button` elements when they mutate UI state.
- Links navigate to actual routes.
- Motion does not block reading.
- Color contrast is readable on blue backgrounds.
- Meaningful imagery has alt text.

## Production deployment checks

- `https://d3vonn.io/` loads with HTTPS.
- Static assets cache correctly.
- Public telemetry returns public-safe data only.
- Route refresh works on direct URLs.
- Social preview image resolves.
- Vercel deployment is green.
- Error logging shows no new homepage runtime errors.
