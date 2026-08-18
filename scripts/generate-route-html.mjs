import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CANONICAL_ORIGIN, PUBLIC_ROUTES, canonicalUrl } from './site-config.mjs';

const distDir = path.resolve('dist');
const source = await readFile(path.join(distDir, 'index.html'), 'utf8');

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function replaceOrInsert(html, pattern, replacement) {
  return pattern.test(html)
    ? html.replace(pattern, replacement)
    : html.replace('</head>', `  ${replacement}\n</head>`);
}

function renderRoute(routePath, title, description, schemaType) {
  const canonical = canonicalUrl(routePath);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title.replace(' | D3VONN.IO', ''),
    url: canonical,
    description,
    isPartOf: { '@type': 'WebSite', name: 'D3VONN.IO', url: `${CANONICAL_ORIGIN}/` }
  });

  let html = source;
  html = replaceOrInsert(html, /<title>.*?<\/title>/s, `<title>${safeTitle}</title>`);
  html = replaceOrInsert(html, /<meta name="description" content=".*?"\s*\/?>/s, `<meta name="description" content="${safeDescription}" />`);
  html = replaceOrInsert(html, /<link rel="canonical" href=".*?"\s*\/?>/s, `<link rel="canonical" href="${canonical}" />`);
  html = replaceOrInsert(html, /<meta property="og:title" content=".*?"\s*\/?>/s, `<meta property="og:title" content="${safeTitle}" />`);
  html = replaceOrInsert(html, /<meta property="og:description" content=".*?"\s*\/?>/s, `<meta property="og:description" content="${safeDescription}" />`);
  html = replaceOrInsert(html, /<meta property="og:url" content=".*?"\s*\/?>/s, `<meta property="og:url" content="${canonical}" />`);
  html = replaceOrInsert(html, /<meta name="twitter:title" content=".*?"\s*\/?>/s, `<meta name="twitter:title" content="${safeTitle}" />`);
  html = replaceOrInsert(html, /<meta name="twitter:description" content=".*?"\s*\/?>/s, `<meta name="twitter:description" content="${safeDescription}" />`);
  html = html.replace(/<script id="route-schema" type="application\/ld\+json">.*?<\/script>/s, '');
  html = html.replace('</head>', `  <script id="route-schema" type="application/ld+json">${schema}</script>\n</head>`);
  return html;
}

await mkdir(distDir, { recursive: true });
for (const [routePath, title, description, schemaType] of PUBLIC_ROUTES.filter(([routePath]) => routePath !== '/')) {
  const outputPath = path.join(distDir, `${routePath.slice(1)}.html`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    renderRoute(routePath, title, description, schemaType),
    'utf8'
  );
}

console.log(`Generated ${PUBLIC_ROUTES.length - 1} route-specific HTML pages.`);
