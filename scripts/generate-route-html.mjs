import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const sourcePath = path.join(distDir, 'index.html');
const source = await readFile(sourcePath, 'utf8');

const publicRoutes = [
  { path: '/solutions', title: 'AI Business Solutions | D3VONN.IO', description: 'Explore D3VONN.IO solutions for AI agents, workflow automation, orchestration, and autonomous business operations.' },
  { path: '/pricing', title: 'Pricing | D3VONN.IO', description: 'Review D3VONN.IO pricing and choose the right plan for AI agents, workflows, and business automation.' },
  { path: '/security', title: 'Security | D3VONN.IO', description: 'Learn how D3VONN.IO protects AI workflows, data, infrastructure, and operational access.' },
  { path: '/resources', title: 'Resources | D3VONN.IO', description: 'Access D3VONN.IO guides, documentation, and resources for building with AI agents and automation.' },
  { path: '/ai-agents', title: 'AI Agents | D3VONN.IO', description: 'Build, deploy, and coordinate specialized AI agents with D3VONN.IO.' },
  { path: '/business-automation', title: 'Business Automation | D3VONN.IO', description: 'Automate business workflows and coordinate intelligent operations with D3VONN.IO.' },
  { path: '/marketplace', title: 'AI Agent Marketplace | D3VONN.IO', description: 'Discover and deploy AI agents from the D3VONN.IO marketplace.' },
  { path: '/film', title: 'AI Film Studio | D3VONN.IO', description: 'Create an AI-generated screenplay and film experience with the D3VONN.IO AI Film Studio.' },
  { path: '/documentation', title: 'Documentation | D3VONN.IO', description: 'Read D3VONN.IO documentation for platform setup, AI agents, workflows, APIs, and deployment.' },
  { path: '/about', title: 'About D3VONN.IO', description: 'Learn about D3VONN.IO and its mission to power autonomous AI-driven businesses.' },
  { path: '/contact', title: 'Contact D3VONN.IO', description: 'Contact D3VONN.IO for product, partnership, support, and business inquiries.' },
  { path: '/terms', title: 'Terms of Service | D3VONN.IO', description: 'Read the D3VONN.IO terms of service.' },
  { path: '/privacy', title: 'Privacy Policy | D3VONN.IO', description: 'Read the D3VONN.IO privacy policy.' }
];

const privateRoutes = [
  '/app', '/admin', '/occ', '/dashboard', '/login', '/signin', '/signup',
  '/unauthorized', '/github-diagnostic', '/command-center', '/agents',
  '/workflows', '/deployment', '/api', '/flow', '/status', '/manifest',
  '/chat', '/research-os', '/dkos-ingestion', '/knowledge-ingestion',
  '/security/ops', '/security/dashboard', '/security/command-center',
  '/jetson', '/jetson-control', '/backtesting'
];

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `  ${replacement}\n</head>`);
}

function renderRoute(routePath, title, description, noindex = false) {
  const canonical = `https://d3vonn.io${routePath}`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);

  let html = source;
  html = replaceTag(html, /<title>.*?<\/title>/s, `<title>${safeTitle}</title>`);
  html = replaceTag(html, /<meta name="description" content=".*?"\s*\/>/s, `<meta name="description" content="${safeDescription}" />`);
  html = replaceTag(html, /<link rel="canonical" href=".*?"\s*\/>/s, `<link rel="canonical" href="${canonical}" />`);
  html = replaceTag(html, /<meta property="og:title" content=".*?"\s*\/>/s, `<meta property="og:title" content="${safeTitle}" />`);
  html = replaceTag(html, /<meta property="og:description" content=".*?"\s*\/>/s, `<meta property="og:description" content="${safeDescription}" />`);
  html = replaceTag(html, /<meta property="og:url" content=".*?"\s*\/>/s, `<meta property="og:url" content="${canonical}" />`);
  html = replaceTag(html, /<meta name="twitter:title" content=".*?"\s*\/>/s, `<meta name="twitter:title" content="${safeTitle}" />`);
  html = replaceTag(html, /<meta name="twitter:description" content=".*?"\s*\/>/s, `<meta name="twitter:description" content="${safeDescription}" />`);

  if (noindex) {
    html = replaceTag(html, /<meta name="robots" content=".*?"\s*\/>/s, '<meta name="robots" content="noindex, nofollow, noarchive" />');
  }

  return html;
}

for (const route of publicRoutes) {
  const filename = path.join(distDir, `${route.path.slice(1)}.html`);
  await writeFile(filename, renderRoute(route.path, route.title, route.description), 'utf8');
}

for (const routePath of privateRoutes) {
  const filename = path.join(distDir, `${routePath.slice(1).replaceAll('/', '__')}.html`);
  await writeFile(filename, renderRoute(routePath, 'D3VONN.IO Secure Application', 'Authenticated D3VONN.IO application area.', true), 'utf8');
}

console.log(`Generated ${publicRoutes.length} public route pages and ${privateRoutes.length} noindex route pages.`);
