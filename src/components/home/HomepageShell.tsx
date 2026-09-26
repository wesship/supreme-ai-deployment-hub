import React from 'react';
import D3VONNMarketingShell from '@/components/marketing/D3VONNMarketingShell';
import InstitutePreviewSection from '@/components/home/InstitutePreviewSection';

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
  <D3VONNMarketingShell
    atmosphere={false}
    className={`d3-homepage-world ${className ?? ''}`.trim()}
  >
    {children}
    <InstitutePreviewSection />
  </D3VONNMarketingShell>
);

export default HomepageShell;
