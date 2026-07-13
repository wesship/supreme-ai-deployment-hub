import React from 'react';
import Navbar from '@/components/Navbar';
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
  transparentHeader = false,
}: PublicPageShellProps) => (
  <div className="min-h-screen bg-[#020714] text-white">
    <Navbar transparent={transparentHeader} />
    <div className="pt-16 lg:pt-[72px]">
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
