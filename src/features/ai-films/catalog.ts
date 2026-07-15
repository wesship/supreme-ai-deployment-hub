export type AIFilm = {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: string;
  year: number;
  maturity: string;
  topics: string[];
  featured?: boolean;
  posterUrl?: string;
  trailerUrl?: string;
};

export const aiFilmCatalog: AIFilm[] = [
  {
    id: 'sovereign-signal',
    title: 'Sovereign Signal',
    category: 'D3VONN Originals',
    description: 'A cinematic AI thriller about intelligence, sovereignty, and the signal that changes civilization.',
    duration: 'Feature Film',
    year: 2026,
    maturity: 'PG-13',
    topics: ['AI sovereignty', 'autonomous systems', 'future society'],
    featured: true,
  },
  {
    id: 'building-d3vonn',
    title: 'Building D3VONN.IO',
    category: 'Documentary',
    description: 'Inside the architecture, agents, infrastructure, and vision behind one platform of infinite intelligence.',
    duration: 'Docuseries',
    year: 2026,
    maturity: 'All audiences',
    topics: ['platform architecture', 'agents', 'infrastructure'],
  },
  {
    id: 'inside-hermes',
    title: 'Inside HERMES',
    category: 'Engineering',
    description: 'A deep dive into the canonical orchestration engine powering governed multi-agent execution.',
    duration: '28 min',
    year: 2026,
    maturity: 'All audiences',
    topics: ['orchestration', 'multi-agent systems', 'governance'],
  },
  {
    id: 'guardian',
    title: 'GUARDIAN',
    category: 'Security',
    description: 'Governance, policy enforcement, human approval, and trust across autonomous AI systems.',
    duration: '22 min',
    year: 2026,
    maturity: 'All audiences',
    topics: ['security', 'policy', 'human-in-the-loop'],
  },
  {
    id: 'ai-workforce',
    title: 'AI Workforce',
    category: 'Enterprise',
    description: 'How autonomous agents reshape operations, customer service, research, and business execution.',
    duration: '34 min',
    year: 2026,
    maturity: 'All audiences',
    topics: ['enterprise AI', 'automation', 'future of work'],
  },
  {
    id: 'genesis-protocol',
    title: 'Genesis Protocol',
    category: 'D3VONN Originals',
    description: 'The first intelligence awakens inside a distributed machine civilization.',
    duration: 'Coming Soon',
    year: 2027,
    maturity: 'PG-13',
    topics: ['machine civilization', 'emergence', 'science fiction'],
  },
];

export const aiFilmCategories = ['All', ...Array.from(new Set(aiFilmCatalog.map((film) => film.category)))];
