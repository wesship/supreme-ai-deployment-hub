import React from 'react';
import Footer from '@/components/Footer';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs';
import { cn } from '@/lib/utils';

interface PublicPageShellProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[] | false;
  className?: string;
  transparentHeader?: boolean;
}

const PublicPageShell = ({
  children,
  breadcrumbs,
  className,
}: PublicPageShellProps) => (
  <div className="d3-public-page min-h-screen text-white">
    <div>
      {breadcrumbs !== false && (
        <div className="border-b border-white/[0.06] bg-black/10">
          <Breadcrumbs items={breadcrumbs || undefined} />
        </div>
      )}
      <div className={cn('outline-none', className)}>
        {children}
      </div>
    </div>
    <Footer />
  </div>
);

export default PublicPageShell;
