export type NavigationItem = {
  name: string;
  path: string;
  /** Requires an authenticated session — unauthenticated clicks are routed through /login. */
  protected?: boolean;
};

export const navigationItems: NavigationItem[] = [
  { name: 'Platform', path: '/platform' },
  { name: 'Hermes', path: '/workflows', protected: true },
  { name: 'Agents', path: '/agents', protected: true },
  { name: 'Knowledge Graph', path: '/knowledge-graph', protected: true },
  { name: 'Workflows', path: '/workflows', protected: true },
  { name: 'Integrations', path: '/mcp', protected: true },
  { name: 'Solutions', path: '/solutions' },
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Security', path: '/security' },
  { name: 'Institute', path: '/institute' },
  { name: 'Pricing', path: '/pricing' },
];
