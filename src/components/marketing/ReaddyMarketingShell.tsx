import React from 'react';
import PublicPageShell from '@/components/shell/PublicPageShell';
import { cn } from '@/lib/utils';

interface ReaddyMarketingShellProps {
  children: React.ReactNode;
  className?: string;
  atmosphere?: boolean;
}

/**
 * Shared shell for the public Readdy-derived D3VONN marketing surfaces.
 *
 * Keeps the existing public shell, footer, keyboard behavior, and global
 * application boundaries while applying the cinematic D3VONN visual world.
 * The atmosphere can be disabled for pages, such as the homepage, that own
 * their own section-level cinematic backgrounds.
 */
const ReaddyMarketingShell = ({
  children,
  className,
  atmosphere = true,
}: ReaddyMarketingShellProps) => (
  <PublicPageShell
    breadcrumbs={false}
    className={cn('relative overflow-hidden bg-[#010611] text-white', className)}
  >
    {atmosphere && (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(37,126,255,0.16),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(0,212,255,0.08),transparent_28%),linear-gradient(180deg,rgba(4,16,44,0.18),rgba(1,6,17,0))]"
      />
    )}
    <div className="relative">{children}</div>
  </PublicPageShell>
);

export default ReaddyMarketingShell;
