import React from 'react';
import PublicPageShell from '@/components/shell/PublicPageShell';
import { cn } from '@/lib/utils';

interface D3VONNMarketingShellProps {
  children: React.ReactNode;
  className?: string;
  atmosphere?: boolean;
}

const D3VONNMarketingShell = ({
  children,
  className,
  atmosphere = true,
}: D3VONNMarketingShellProps) => (
  <PublicPageShell
    breadcrumbs={false}
    className={cn('relative overflow-hidden bg-[#080806] text-white', className)}
  >
    {atmosphere && (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(252,211,77,0.08),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(251,146,60,0.05),transparent_28%),linear-gradient(180deg,rgba(28,24,14,0.16),rgba(8,8,6,0))]"
      />
    )}
    <div className="relative">{children}</div>
  </PublicPageShell>
);

export default D3VONNMarketingShell;
