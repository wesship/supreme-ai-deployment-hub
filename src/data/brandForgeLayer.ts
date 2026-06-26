import { AgentTemplate } from '@/types/marketplace';

export type BrandForgeWorkflowStage = {
  id: string;
  name: string;
  ownerAgent: string;
  description: string;
  inputs: string[];
  outputs: string[];
  requiresHumanApproval?: boolean;
};

export const brandForgeWorkflowStages: BrandForgeWorkflowStage[] = [
  {
    id: 'crawl',
    name: 'Brand Crawl',
    ownerAgent: 'Firecrawl Research Agent',
    description: 'Extracts public brand assets, colors, typography clues, messaging, screenshots, product pages, CTAs, offers, and proof points from approved URLs.',
    inputs: ['approved brand URL', 'allowed crawl depth', 'competitor URLs'],
    outputs: ['raw page map', 'asset inventory', 'copy inventory', 'CTA inventory', 'visual references']
  },
  {
    id: 'brand-kit',
    name: 'Brand Kit Synthesis',
    ownerAgent: 'Brand Strategist Agent',
    description: 'Turns crawled assets into a structured brand kit with voice, positioning, audience, color direction, typography direction, layout rules, and conversion goals.',
    inputs: ['raw page map', 'asset inventory', 'business goal'],
    outputs: ['brand kit JSON', 'positioning brief', 'voice guide', 'design constraints']
  },
  {
    id: 'creative-direction',
    name: 'Creative Direction',
    ownerAgent: 'Creative Director Agent',
    description: 'Creates multiple visual directions for hero sections, page mood, motion language, landing-page hierarchy, and campaign-ready variants.',
    inputs: ['brand kit JSON', 'target audience', 'offer type'],
    outputs: ['visual direction options', 'hero prompt set', 'motion prompt set', 'page wireframe brief'],
    requiresHumanApproval: true
  },
  {
    id: 'visual-generation',
    name: 'Visual Generation',
    ownerAgent: 'Nano Banana Visual Agent',
    description: 'Generates branded hero visuals, social images, thumbnails, product mockups, and image transitions based on approved creative direction.',
    inputs: ['approved creative direction', 'logo assets', 'style constraints'],
    outputs: ['hero visuals', 'brand graphics', 'thumbnail concepts', 'image prompt history']
  },
  {
    id: 'motion-generation',
    name: 'Motion and Video Assembly',
    ownerAgent: 'OpenMontage Video Agent',
    description: 'Turns scripts and assets into hero transition videos, short promos, product trailers, and launch clips.',
    inputs: ['script', 'storyboard', 'approved visuals', 'music/voice settings'],
    outputs: ['render plan', 'caption plan', 'video assets', 'review package'],
    requiresHumanApproval: true
  },
  {
    id: 'site-build',
    name: 'Claude Code Site Build',
    ownerAgent: 'Code Builder Agent',
    description: 'Builds or improves the website structure, sections, components, responsive layout, and conversion flow using the approved brand system.',
    inputs: ['brand kit JSON', 'wireframe brief', 'approved visuals', 'content outline'],
    outputs: ['React components', 'page route', 'content blocks', 'responsive layout']
  },
  {
    id: 'qa',
    name: 'QA and Brand Review',
    ownerAgent: 'QA Guardian Agent',
    description: 'Checks brand consistency, accessibility, mobile layout, link behavior, metadata, image sizing, and conversion clarity before deployment.',
    inputs: ['preview build', 'brand kit JSON', 'acceptance checklist'],
    outputs: ['QA report', 'fix list', 'approval status'],
    requiresHumanApproval: true
  },
  {
    id: 'deploy',
    name: 'GitHub + Vercel Deployment',
    ownerAgent: 'Deployment Agent',
    description: 'Commits the approved site changes to GitHub and deploys preview or production through Vercel.',
    inputs: ['approved code', 'deployment target', 'environment rules'],
    outputs: ['GitHub PR', 'Vercel preview URL', 'release notes'],
    requiresHumanApproval: true
  }
];

export const brandForgeAgentTemplates: AgentTemplate[] = [
  {
    id: 'agent-brandforge-001',
    name: 'BrandForge Site Builder',
    slug: 'brandforge-site-builder',
    description: 'Turns any approved brand URL into a deploy-ready landing page system with extracted brand assets, generated visuals, motion assets, QA, GitHub, and Vercel handoff.',
    longDescription: `BrandForge Site Builder is the D3VONN.IO brand-to-site production agent.

Workflow:
- Crawl approved brand URLs with Firecrawl-style extraction
- Build a structured brand kit with voice, colors, typography direction, CTAs, offers, and proof points
- Generate visual directions for Claude Code and image/video models
- Generate hero visuals, thumbnails, and branded imagery
- Build or improve responsive React landing pages
- Use OpenMontage for motion/video assets
- Create GitHub PRs and Vercel preview deployments after approval

Best use cases:
- New landing pages
- Client website rebuilds
- Campaign pages
- AI-generated brand demos
- D3VONN.IO internal page upgrades
- Agency-style rapid production`,
    category: 'automation',
    capabilities: ['integration', 'reporting', 'scheduling', 'ml-powered', 'monitoring'],
    pricing: { model: 'subscription', amount: 199, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'devonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 14
    },
    status: 'published',
    version: '1.0.0',
    icon: '🏗️',
    tags: ['brandforge', 'firecrawl', 'claude-code', 'nano-banana', 'openmontage', 'vercel', 'github', 'landing-page'],
    requirements: ['Approved source URLs', 'Brand asset usage rights', 'GitHub repository access', 'Vercel project access'],
    integrations: ['Firecrawl', 'Claude Code', 'Nano Banana', 'OpenMontage', 'GitHub', 'Vercel', 'Figma'],
    stats: {
      downloads: 0,
      activeInstalls: 0,
      avgRating: 5.0,
      reviewCount: 0,
      lastUpdated: '2026-06-26'
    },
    createdAt: '2026-06-26',
    updatedAt: '2026-06-26',
    featured: true
  },
  {
    id: 'agent-brandforge-002',
    name: 'Brand Direction Analyst',
    slug: 'brand-direction-analyst',
    description: 'Analyzes brand positioning, visual direction, copy hierarchy, competitors, proof points, and conversion gaps before code or visuals are generated.',
    longDescription: `Brand Direction Analyst prevents generic AI websites by forcing strategy before generation.

It produces:
- Positioning summary
- Audience map
- Offer clarity score
- Brand asset inventory
- Competitor pattern notes
- Visual direction options
- Copy hierarchy recommendations
- Conversion risk list
- Approval checklist for Claude Code, Nano Banana, OpenMontage, GitHub, and Vercel`,
    category: 'analytics',
    capabilities: ['reporting', 'ml-powered', 'monitoring'],
    pricing: { model: 'subscription', amount: 99, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'devonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 14
    },
    status: 'published',
    version: '1.0.0',
    icon: '🧭',
    tags: ['brand-strategy', 'positioning', 'conversion', 'creative-direction', 'copywriting', 'website-audit'],
    requirements: ['Brand URL or uploaded brand assets', 'Business goal', 'Target audience'],
    integrations: ['Firecrawl', 'Storybook', 'Figma', 'GitHub'],
    stats: {
      downloads: 0,
      activeInstalls: 0,
      avgRating: 5.0,
      reviewCount: 0,
      lastUpdated: '2026-06-26'
    },
    createdAt: '2026-06-26',
    updatedAt: '2026-06-26',
    featured: true
  }
];

export const brandForgeSummary = {
  layerName: 'BrandForge Brand-to-Site Production Layer',
  mission: 'Convert approved brand inputs into production-ready websites, visuals, videos, and deployable GitHub/Vercel releases.',
  stages: brandForgeWorkflowStages.map((stage) => stage.id),
  guardrails: [
    'Do not scrape or reuse brand assets without authorization.',
    'Require human approval before creative direction, video rendering, and production deployment.',
    'Store prompt history and generated asset provenance for brand safety.',
    'Run accessibility, SEO, responsive layout, and link QA before deployment.',
    'Keep generated websites from becoming generic by requiring positioning and visual direction before code generation.'
  ]
};
