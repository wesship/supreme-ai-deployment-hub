import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const source = await readFile(path.join(distDir, 'index.html'), 'utf8');

const publicRoutes = [
  ['/solutions', 'AI Business Solutions | D3VONN.IO', 'Explore D3VONN.IO solutions for AI agents, workflow automation, orchestration, and autonomous business operations.', 'Service'],
  ['/pricing', 'Pricing | D3VONN.IO', 'Review D3VONN.IO pricing and choose the right plan for AI agents, workflows, and business automation.', 'WebPage'],
  ['/security', 'Security | D3VONN.IO', 'Learn how D3VONN.IO protects AI workflows, data, infrastructure, and operational access.', 'WebPage'],
  ['/resources', 'Resources | D3VONN.IO', 'Access D3VONN.IO guides, documentation, and resources for building with AI agents and automation.', 'CollectionPage'],
  ['/ai-agents', 'AI Agents | D3VONN.IO', 'Build, deploy, and coordinate specialized AI agents with D3VONN.IO.', 'SoftwareApplication'],
  ['/business-automation', 'Business Automation | D3VONN.IO', 'Automate business workflows and coordinate intelligent operations with D3VONN.IO.', 'Service'],
  ['/marketplace', 'AI Agent Marketplace | D3VONN.IO', 'Discover and deploy AI agents from the D3VONN.IO marketplace.', 'CollectionPage'],
  ['/film', 'OpenMontage AI Film Studio | D3VONN.IO', 'Create a governed AI screenplay and film through the D3VONN.IO OpenMontage production workflow.', 'WebApplication'],
  ['/documentation', 'Documentation | D3VONN.IO', 'Read D3VONN.IO documentation for platform setup, AI agents, workflows, APIs, and deployment.', 'TechArticle'],
  ['/about', 'About D3VONN.IO', 'Learn about D3VONN.IO and its mission to power autonomous AI-driven businesses.', 'AboutPage'],
  ['/contact', 'Contact D3VONN.IO', 'Contact D3VONN.IO for product, partnership, support, and business inquiries.', 'ContactPage'],
  ['/terms', 'Terms of Service | D3VONN.IO', 'Read the D3VONN.IO terms of service.', 'WebPage'],
  ['/privacy', 'Privacy Policy | D3VONN.IO', 'Read the D3VONN.IO privacy policy.', 'WebPage']
];

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
  const canonical = `https://d3vonn.io${routePath}`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title.replace(' | D3VONN.IO', ''),
    url: canonical,
    description,
    isPartOf: { '@type': 'WebSite', name: 'D3VONN.IO', url: 'https://d3vonn.io/' }
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
for (const [routePath, title, description, schemaType] of publicRoutes) {
  await writeFile(
    path.join(distDir, `${routePath.slice(1)}.html`),
    renderRoute(routePath, title, description, schemaType),
    'utf8'
  );
}

console.log(`Generated ${publicRoutes.length} route-specific HTML pages.`);
