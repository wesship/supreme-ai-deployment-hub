
## Homepage design system
- The public homepage (`/`) renders its own light "D3OS" chrome (`src/styles/d3os.css` scoped to `.d3os`, plus `src/components/d3os/*`), and `App.tsx` suppresses the shared dark `Navbar` and the `pt-16` offset on that route only — the marketing surface needs a light, full-width shell while the authenticated app stays dark.
