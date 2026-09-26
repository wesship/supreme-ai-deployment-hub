
import React from 'react';
import NavLink from './NavLink';

interface DesktopNavProps {
  navigationItems: Array<{ name: string; path: string; protected?: boolean }>;
  currentPath: string;
}

const DesktopNav: React.FC<DesktopNavProps> = ({ navigationItems, currentPath }) => {
  return (
    <nav className="hidden 2xl:flex items-center gap-5">
      {navigationItems.map(item => (
        <NavLink
          key={item.name}
          to={item.path}
          currentPath={currentPath}
          requiresAuth={item.protected}
        >
          {item.name}
        </NavLink>
      ))}
    </nav>
  );
};

export default DesktopNav;
