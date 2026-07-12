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
    <a
      href="#main-content"
      className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white shadow-xl transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      Skip to main content
    </a>
    <Navbar transparent={transparentHeader} />
    <div className="pt-16 lg:pt-[72px]">
      {breadcrumbs !== false && (
        <div className="border-b border-white/[0.06] bg-black/10">
          <Breadcrumbs items={breadcrumbs || undefined} />
        </div>
      )}
      <main id="main-content" tabIndex={-1} className={cn('outline-none', className)}>
        {children}
      </main>
    </div>
    <Footer />
  </div>
);

export default PublicPageShell;
