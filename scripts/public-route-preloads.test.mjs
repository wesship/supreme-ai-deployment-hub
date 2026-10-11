import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { collectPreloads, preloadPublicRoute, publicRoutePreloads } from './public-route-preloads.mjs';

test('build hook resolves merged chunks and emits an external content-hashed script', () => {
  const plugin = publicRoutePreloads();
  plugin.configResolved({ base: '/' });
  const bundle = {
    'App.js': { type: 'chunk', fileName: 'App.js', moduleIds: ['/repo/src/App.tsx'], imports: [] },
    'Film.js': { type: 'chunk', fileName: 'Film.js', moduleIds: ['/repo/src/pages/AIFilms.tsx'], imports: [] },
    'index.html': { type: 'asset', source: '<html><head></head><body></body></html>' },
  };
  let emitted;
  const context = { emitFile: (asset) => { emitted = asset; }, error: (message) => { throw new Error(message); } };
  plugin.generateBundle.handler.call(context, {}, bundle);
  assert.match(emitted.fileName, /^assets\/public-route-preloads-[a-f0-9]{12}\.js$/);
  assert.match(bundle['index.html'].source, /<script async src="\/assets\/public-route-preloads-/);
  assert.match(emitted.source, /sovereign-signal-keyframe\.webp/);
  const dom = new JSDOM('<head></head>', { url: 'https://example.com/', runScripts: 'outside-only' });
  dom.window.eval(emitted.source);
  assert.equal(dom.window.document.querySelectorAll('link').length, 1);
  assert.equal(dom.window.document.querySelector('link').getAttribute('href'), '/approved-home/emblem.webp');
  dom.window.close();
  delete bundle['Film.js'];
  assert.throws(() => plugin.generateBundle.handler.call(context, {}, bundle), /Film=false/);
});

test('static dependency traversal deduplicates cycles and skips lazy chunks', () => {
  const chunk = (imports, css = [], dynamicImports = []) => ({
    type: 'chunk', imports, dynamicImports, viteMetadata: { importedCss: new Set(css) },
  });
  const bundle = {
    'App.js': chunk(['react.js', 'shell.js'], ['App.css'], ['private.js']),
    'react.js': chunk([]),
    'shell.js': chunk(['react.js', 'App.js'], ['App.css', 'shell.css']),
    'private.js': chunk([], ['private.css']),
  };
  assert.deepEqual(collectPreloads(bundle, 'App.js'), {
    modules: ['App.js', 'react.js', 'shell.js'], styles: ['App.css', 'shell.css'],
  });
});

test('route hints select the correct hero and leave workspace routes alone', () => {
  const home = { image: 'emblem.webp', modules: ['App.js'], styles: ['App.css'] };
  const film = { image: 'poster.webp', modules: ['App.js', 'Film.js'], styles: ['App.css'] };
  const routes = { '/': home, '/film': film, '/ai-films': film };
  for (const [path, expected] of [['/', home], ['/film/', film], ['/ai-films', film], ['/client-ai', null], ['/knowledge-graph', null]]) {
    const dom = new JSDOM('<head></head>', { url: `https://example.com${path}`, runScripts: 'outside-only' });
    dom.window.eval(`(${preloadPublicRoute.toString()})(${JSON.stringify(routes)}, '/');`);
    const links = [...dom.window.document.querySelectorAll('link')];
    assert.equal(links.length, expected ? 1 + expected.modules.length + expected.styles.length : 0);
    if (expected) {
      assert.equal(links[0].getAttribute('href'), `/${expected.image}`);
      assert.equal(links[0].fetchPriority, 'high');
      assert.equal(links[1].rel, 'modulepreload');
      assert.equal(links[1].crossOrigin, '');
      assert.equal(links.at(-1).rel, 'preload');
      assert.equal(links.at(-1).as, 'style');
      assert.equal(dom.window.document.querySelector('script'), null);
    }
    dom.window.close();
  }
});
