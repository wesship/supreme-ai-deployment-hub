import type { ProductVideoSpec } from '@/components/media/ProductVideo';

/**
 * Central registry for D3VONN product videos (the seven P0 launch assets
 * from the video roadmap). A video ships by dropping its files in
 * public/videos/ and filling in mp4/webm/poster below — sections that
 * consume this registry render nothing for unconfigured entries, so no
 * placeholders ever appear publicly.
 */
export const productVideos: Record<string, ProductVideoSpec> = {
  masterDemo: {
    id: 'master-demo',
    title: 'What Is D3VONN.IO?',
    description:
      'A business goal becomes a Hermes plan, governed agent execution, a human approval, and a measured outcome — end to end.',
    mp4: null,
    webm: null,
    poster: '/illustrations/workflow-pipeline.svg',
    kind: 'instructional',
    maturity: 'Live Product',
  },
  commandCenter: {
    id: 'loop-command-center',
    title: 'Command Center',
    description: 'Live agent runs, task states, and operational telemetry in one view.',
    mp4: null,
    webm: null,
    kind: 'loop',
    maturity: 'Live Product',
  },
  knowledgeGraph: {
    id: 'loop-knowledge-graph',
    title: 'Knowledge Graph / DKOS',
    description: 'Documents become grounded, queryable knowledge for every agent.',
    mp4: null,
    webm: null,
    kind: 'loop',
    maturity: 'Live Product',
  },
  workflowBuilder: {
    id: 'loop-workflow-builder',
    title: 'Workflow Builder',
    description: 'Design multi-step processes with agents, tools, and approval gates.',
    mp4: null,
    webm: null,
    kind: 'loop',
    maturity: 'Live Product',
  },
  movieStudio: {
    id: 'loop-movie-studio',
    title: 'AI Movie Studio',
    description: 'Script to scene inside the D3VONN Studios pipeline.',
    mp4: null,
    webm: null,
    kind: 'loop',
    maturity: 'Beta',
  },
  securityCenter: {
    id: 'loop-security-center',
    title: 'Security Command Center',
    description: 'Approvals, audit trails, and fail-closed policy in action.',
    mp4: null,
    webm: null,
    kind: 'loop',
    maturity: 'Live Product',
  },
  marketplace: {
    id: 'loop-marketplace',
    title: 'Agent Marketplace',
    description: 'Find, configure, and deploy specialized agents in minutes.',
    mp4: null,
    webm: null,
    kind: 'loop',
    maturity: 'Beta',
  },
};

export const configuredVideos = (): ProductVideoSpec[] =>
  Object.values(productVideos).filter((v) => v.mp4 || v.webm);
