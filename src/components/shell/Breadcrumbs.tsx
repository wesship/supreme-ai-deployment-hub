import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

const titleCase = (segment: string) =>
  segment
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const Breadcrumbs = ({ items }: BreadcrumbsProps) => {
  const location = useLocation();
  const generated = location.pathname
    .split('/')
    .filter(Boolean)
    .map((segment, index, segments) => ({
      label: titleCase(segment),
      to: index === segments.length - 1 ? undefined : `/${segments.slice(0, index + 1).join('/')}`,
    }));
  const trail = items ?? generated;

  if (!trail.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <ol className="flex min-h-11 flex-wrap items-center gap-1.5 text-xs text-white/45">
        <li>
          <Link to="/" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 transition hover:bg-white/[0.05] hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70">
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {trail.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5 text-white/20" /></li>
            <li>
              {item.to ? (
                <Link to={item.to} className="inline-flex min-h-9 items-center rounded-lg px-2 transition hover:bg-white/[0.05] hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="inline-flex min-h-9 items-center px-2 font-semibold text-blue-100/80">{item.label}</span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
