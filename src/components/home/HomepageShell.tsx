import React from 'react';
import PublicPageShell from '@/components/shell/PublicPageShell';

interface HomepageShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Canonical public shell for the D3VONN.IO homepage.
 *
 * The homepage intentionally suppresses breadcrumbs while preserving the
 * shared enterprise header, footer, skip link, main landmark, keyboard
 * navigation, and reduced-motion behavior established for RC1.
 */
const HomepageShell = ({ children, className }: HomepageShellProps) => (
  <PublicPageShell
    breadcrumbs={false}
    transparentHeader
    className={`d3-homepage-world ${className ?? ''}`.trim()}
  >
    {children}
  </PublicPageShell>
);

export default HomepageShell;
