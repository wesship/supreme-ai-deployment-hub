import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CANONICAL_ORIGIN, PUBLIC_ROUTES, canonicalUrl } from './site-config.mjs';

const publicDir = path.resolve('public');
await mkdir(path.join(publicDir, '.well-known'), { recursive: true });

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...PUBLIC_ROUTES.map(([routePath, , , , changefreq, priority]) => `  <url>\n    <loc>${canonicalUrl(routePath)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`),
  '</urlset>',
  '',
].join('\n');

const robots = `User-agent: *
Allow: /

# Private and authenticated surfaces — crawler exclusion is not an access control.
Disallow: /app
Disallow: /admin
Disallow: /occ
Disallow: /dashboard
Disallow: /login
Disallow: /signin
Disallow: /signup
Disallow: /unauthorized
Disallow: /command-center
Disallow: /agents
Disallow: /workflows
Disallow: /deployment
Disallow: /api
Disallow: /flow
Disallow: /status
Disallow: /manifest
Disallow: /chat
Disallow: /research-os
Disallow: /dkos-ingestion
Disallow: /knowledge-ingestion
Disallow: /security/ops
Disallow: /security/dashboard
Disallow: /security/command-center
Disallow: /jetson
Disallow: /jetson-control
Disallow: /backtesting

Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml
`;

const securityTxt = `Contact: mailto:security@d3vonn.io
Contact: ${CANONICAL_ORIGIN}/security/disclosure
Expires: 2027-08-17T00:00:00.000Z
Preferred-Languages: en
Policy: ${CANONICAL_ORIGIN}/security/disclosure
Acknowledgments: ${CANONICAL_ORIGIN}/security/disclosure#acknowledgments
Canonical: ${CANONICAL_ORIGIN}/.well-known/security.txt
`;

await Promise.all([
  writeFile(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8'),
  writeFile(path.join(publicDir, 'robots.txt'), robots, 'utf8'),
  writeFile(path.join(publicDir, '.well-known', 'security.txt'), securityTxt, 'utf8'),
]);

console.log(`Generated crawler assets for ${PUBLIC_ROUTES.length} canonical routes at ${CANONICAL_ORIGIN}.`);
