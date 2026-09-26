
## Homepage design system
- The public homepage (`/`) renders the authenticated-source Readdy V90 presentation (`src/styles/readdy-v90.css`, scoped to `.readdy-v90`, and `src/components/readdy/*`) inside the canonical marketing shell. `App.tsx` suppresses shared navigation on that route, so `Index.tsx` explicitly owns the canonical `Navbar`; `HomepageShell` supplies the canonical footer.
- Keep authentication, backend APIs, Hermes execution, protected routes, and security/deployment configuration canonical. Readdy supplies presentation only; see `docs/readdy/IMPORT_CONTRACT.md` and `docs/readdy/V90_IMPORT.md`.
