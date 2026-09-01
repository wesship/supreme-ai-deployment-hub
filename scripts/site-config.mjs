export const CANONICAL_ORIGIN = (process.env.CANONICAL_SITE_ORIGIN || 'https://www.d3vonn.io').replace(/\/$/, '');

export const PUBLIC_ROUTES = [
  ['/', 'D3VONN.IO — One Platform. Infinite Intelligence.', 'D3VONN.IO is the AI Business Operating System for orchestrating intelligent agents, knowledge, workflows, security, and enterprise operations from one governed platform.', 'WebSite', 'weekly', '1.0'],
  ['/solutions', 'AI Business Solutions | D3VONN.IO', 'Explore D3VONN.IO solutions for AI agents, workflow automation, orchestration, and autonomous business operations.', 'Service', 'weekly', '0.95'],
  ['/pricing', 'Pricing | D3VONN.IO', 'Review D3VONN.IO pricing and choose the right plan for AI agents, workflows, and business automation.', 'WebPage', 'weekly', '0.95'],
  ['/security', 'Security | D3VONN.IO', 'Learn how D3VONN.IO protects AI workflows, data, infrastructure, and operational access.', 'WebPage', 'monthly', '0.9'],
  ['/security/disclosure', 'Vulnerability Disclosure Policy | D3VONN.IO', 'Learn how to securely report a D3VONN.IO vulnerability and what response to expect.', 'WebPage', 'yearly', '0.7'],
  ['/resources', 'Resources | D3VONN.IO', 'Access D3VONN.IO guides, documentation, and resources for building with AI agents and automation.', 'CollectionPage', 'weekly', '0.9'],
  ['/ai-agents', 'AI Agents | D3VONN.IO', 'Build, deploy, and coordinate specialized AI agents with D3VONN.IO.', 'SoftwareApplication', 'weekly', '0.95'],
  ['/business-automation', 'Business Automation | D3VONN.IO', 'Automate business workflows and coordinate intelligent operations with D3VONN.IO.', 'Service', 'weekly', '0.95'],
  ['/marketplace', 'AI Agent Marketplace | D3VONN.IO', 'Discover and deploy AI agents from the D3VONN.IO marketplace.', 'CollectionPage', 'weekly', '0.9'],
  ['/film', 'OpenMontage AI Film Studio | D3VONN.IO', 'Create a governed AI screenplay and film through the D3VONN.IO OpenMontage production workflow.', 'WebApplication', 'weekly', '0.8'],
  ['/documentation', 'Documentation | D3VONN.IO', 'Read D3VONN.IO documentation for platform setup, AI agents, workflows, APIs, and deployment.', 'TechArticle', 'weekly', '0.8'],
  ['/about', 'About D3VONN.IO', 'Learn about D3VONN.IO and its mission to power autonomous AI-driven businesses.', 'AboutPage', 'monthly', '0.6'],
  ['/contact', 'Contact D3VONN.IO', 'Contact D3VONN.IO for product, partnership, support, and business inquiries.', 'ContactPage', 'monthly', '0.6'],
  ['/mile-high-golden-elevation', 'Mile High Golden Elevation | Denver Fine Jewelry', 'Discover Mile High Golden Elevation, a Denver fine-jewelry company focused on handcrafted pieces, responsible materials, custom design, and private consultation.', 'Organization', 'weekly', '0.7'],
  ['/enterprise-readiness', 'Enterprise Readiness | D3VONN.IO', 'Review current D3VONN.IO enterprise controls, evidence, and dated roadmap milestones.', 'WebPage', 'monthly', '0.8'],
  ['/terms', 'Terms of Service | D3VONN.IO', 'Read the D3VONN.IO terms of service.', 'WebPage', 'yearly', '0.3'],
  ['/privacy', 'Privacy Policy | D3VONN.IO', 'Read the D3VONN.IO privacy policy.', 'WebPage', 'yearly', '0.3'],
];

export const canonicalUrl = (routePath) => `${CANONICAL_ORIGIN}${routePath === '/' ? '/' : routePath}`;
