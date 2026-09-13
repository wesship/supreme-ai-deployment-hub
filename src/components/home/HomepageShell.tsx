import React from 'react';
import ReaddyMarketingShell from '@/components/marketing/ReaddyMarketingShell';

interface HomepageShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Canonical public shell for the D3VONN.IO homepage.
 *
 * The homepage keeps its existing section-level cinematic backgrounds while
 * sharing the same Readdy marketing boundary, footer, keyboard behavior, and
 * application shell as the other certified public marketing routes.
 */
const HomepageShell = ({ children, className }: HomepageShellProps) => (
  <ReaddyMarketingShell
    atmosphere={false}
    className={`d3-homepage-world ${className ?? ''}`.trim()}
  >
    {children}
  </ReaddyMarketingShell>
);

export default HomepageShell;
