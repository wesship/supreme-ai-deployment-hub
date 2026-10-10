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
    className={cn('d3-marketing-page relative overflow-hidden text-white', className)}
  >
    {atmosphere && (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(59,155,255,0.06),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(111,240,255,0.04),transparent_28%)]"
      />
    )}
    <div className="relative">{children}</div>
  </PublicPageShell>
);

export default D3VONNMarketingShell;
