
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  to: string;
  currentPath: string;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, currentPath, children }) => {
  return (
    <Link
      to={to}
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
