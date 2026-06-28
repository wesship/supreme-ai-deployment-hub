export type NavigationItem = {
  name: string;
  path: string;
  /** Requires an authenticated session — unauthenticated clicks are routed through /login. */
  protected?: boolean;
};

export const navigationItems: NavigationItem[] = [
  { name: 'Platform', path: '/platform' },
  { name: 'Solutions', path: '/solutions' },
  { name: 'Agents', path: '/agents', protected: true },
  { name: 'Resources', path: '/resources' },
  { name: 'Security', path: '/security' },
  { name: 'Pricing', path: '/pricing' },
];
