# Offline Code Map

Read-only code intelligence for D3VONN.IO and Hermes. An original implementation inspired by the source-map pattern; no Felhaven source code or assets are included.

## Run

Python 3.10+ and Node.js are required. Python parsing uses the standard-library AST. TypeScript/JavaScript parsing uses the repository's existing `typescript` dependency (install project dependencies first). No model, subscription, network connection, or project code execution is needed during scanning or viewing.

```bash
python tools/code_map/code_map.py --root . build --output /tmp/d3vonn-code-map.html
python tools/code_map/code_map.py --root . search Hermes
python tools/code_map/code_map.py --root . quote backend/main.py 1 40
python -m unittest discover -s tools/code_map -p 'test_*.py'
```

Open the generated HTML locally. Search files/symbols, select graph neighbors, inspect directed import rows, and choose a symbol to view numbered source. The viewer is self-contained and blocks network connections with CSP. The artifact contains source snapshots: keep it private and do not add it to `public/` or commit it.

For an existing TypeScript installation outside the repository, set `CODE_MAP_TYPESCRIPT` to the installed package's absolute path. This is trusted operator configuration, never model input.

## Hermes handoff contract

The CLI is usable now; it is **not registered in the production Hermes tool registry**. A future governed adapter must fix the checkout root and executable arguments, accept only a search term or indexed relative path plus bounded line range, and invoke the CLI without a shell. Do not give an agent control of root, parser environment, or output destination. Keep existing RBAC and tool policy in force.

`search` and `quote` return JSON. Each evidence excerpt includes the relative file path, line range, SHA-256 of the original bytes, and exact source quote. Each invocation scans current files; generated HTML is a point-in-time snapshot. Source comments/docstrings are untrusted data, never agent instructions. Hermes should distinguish quoted code, documented intent, and inferred behavior; it must not assert runtime execution or deployment from this graph.

## Coverage and limits

- Python imports, relative imports, named functions/classes, and literal `importlib.import_module`/`__import__` calls.
- TypeScript/JavaScript imports, re-exports, literal dynamic imports, `require`, and named declarations; tsconfig.app.json aliases resolved with the TypeScript compiler.
- Connections are static imports. No call graph, network/API/database graph, decorators-as-runtime proof, or computed module resolution is claimed.
- Python uses checkout-root module names; alternate PYTHONPATH roots, renamed importlib aliases, and custom loaders can remain unresolved.
- External dependencies and unresolved imports retain their original specifier; they are never invented as local edges.
- Symlink files/directories, common build/dependency folders, non-code files, invalid UTF-8, and files over 1 MB are skipped. Diagnostics report parse/read failures. A failed TypeScript parser aborts the scan rather than silently emitting Python-only results.
- UI shows up to 40 neighbors and 150 search results, with counts; all selected-file imports remain available below the graph. Excerpts are capped at 200 lines.

No public homepage, authentication, deployment, or production API changes are made by this tool.
