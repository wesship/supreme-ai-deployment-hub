
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthState } from '@/hooks/useAuthState';

interface NavLinkProps {
  to: string;
  currentPath: string;
  children: React.ReactNode;
  /** If true, unauthenticated users are routed to /login with a redirect back to `to`. */
  requiresAuth?: boolean;
}

const NavLink: React.FC<NavLinkProps> = ({ to, currentPath, children, requiresAuth }) => {
  const authed = useAuthState();
  // Fail closed: while useAuthState is still resolving (authed === null) a
  // protected link must route through /login just like the confirmed
  // unauthenticated case. Only a confirmed `authed === true` should bypass it.
  const resolvedTo =
    requiresAuth && authed !== true
      ? `/login?redirect=${encodeURIComponent(to)}`
      : to;

  return (
    <Link
      to={resolvedTo}
      className={cn(
        "text-sm font-medium transition-colors relative group",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:rounded-sm",
        currentPath === to
          ? "text-primary"
          : "text-white/70 hover:text-white"
      )}
    >
      {children}
      <span className={cn(
        "absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full",
        currentPath === to ? "w-full" : "w-0"
      )}></span>
    </Link>
  );
};

export default NavLink;
