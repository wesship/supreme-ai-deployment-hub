import { createHash } from 'node:crypto';

// Walk only static imports. Lazy workspace, graph and studio modules stay lazy.
export function collectPreloads(bundle, entry) {
  const modules = new Set();
  const styles = new Set();
  function visit(fileName) {
    if (modules.has(fileName)) return;
    const chunk = bundle[fileName];
    if (!chunk || chunk.type !== 'chunk') return;
    modules.add(fileName);
    for (const css of chunk.viteMetadata?.importedCss ?? []) styles.add(css);
    for (const dependency of chunk.imports) visit(dependency);
  }
  visit(entry);
  return { modules: [...modules], styles: [...styles] };
}

export function preloadPublicRoute(routes, base) {
  const route = routes[window.location.pathname.replace(/\/+$/, '') || '/'];
  if (!route) return;
  function add(rel, href, as) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = base + href;
    if (as) link.as = as;
    if (as === 'image') link.fetchPriority = 'high';
    else link.crossOrigin = '';
    document.head.appendChild(link);
  }
  add('preload', route.image, 'image');
  for (const module of route.modules) add('modulepreload', module);
  // Warm CSS without applying it outside Vite's guarded import lifecycle.
  for (const style of route.styles) add('preload', style, 'style');
}

export function publicRoutePreloads() {
  let base;
  return {
    name: 'public-route-preloads',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { base = config.base; },
    generateBundle: { order: 'post', handler(_options, bundle) {
      const chunks = Object.values(bundle).filter((entry) => entry.type === 'chunk');
      const find = (suffix) => chunks.find((chunk) =>
        [chunk.facadeModuleId, ...chunk.moduleIds].some((id) => id?.replaceAll('\\', '/').endsWith(suffix)));
      const app = find('/src/App.tsx');
      const film = find('/src/pages/AIFilms.tsx');
      const html = bundle['index.html'];
      if (!app || !film || !html || html.type !== 'asset') {
        this.error(`Public route preload entries are missing: App=${Boolean(app)}, Film=${Boolean(film)}, HTML=${Boolean(html)}.`);
      }
      const homeAssets = collectPreloads(bundle, app.fileName);
      const filmAssets = collectPreloads(bundle, film.fileName);
      const filmRoute = {
        modules: [...new Set([...homeAssets.modules, ...filmAssets.modules])],
        styles: [...new Set([...homeAssets.styles, ...filmAssets.styles])],
        image: 'films/sovereign-signal-keyframe.webp',
      };
      const routes = {
        '/': { ...homeAssets, image: 'approved-home/emblem.webp' },
        '/film': filmRoute,
        '/ai-films': filmRoute,
      };
      // External script respects the production script-src 'self' policy. It
      // fetches modules without executing them; main.tsx retains its watchdog.
      const source = `(${preloadPublicRoute.toString()})(${JSON.stringify(routes)},${JSON.stringify(base)});`;
      const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
      const fileName = `assets/public-route-preloads-${hash}.js`;
      this.emitFile({ type: 'asset', fileName, source });
      html.source = String(html.source).replace('<head>', `<head>\n    <script async src="${base}${fileName}"></script>`);
    } },
  };
}
