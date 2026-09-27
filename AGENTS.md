## Homepage design system
- The public homepage (`/`) is the repository-native D3VONN Neural Nexus / Knowledge Graph experience rendered by `src/pages/Index.tsx` → `src/pages/KnowledgeGraphOS.tsx`. It owns its full-screen application chrome, so `App.tsx` suppresses the shared navbar on `/` and `/knowledge-graph`.
- The canonical frontend authority is this repository. Readdy assets under `src/components/readdy/*`, `src/styles/readdy-v90.css`, and `docs/readdy/*` are retained only as historical/reference material and must not become the production runtime shell.
- Keep authentication, backend APIs, Hermes execution, protected routes, security, voice orchestration, and deployment configuration canonical and repository-native.
