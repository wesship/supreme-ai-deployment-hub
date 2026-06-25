import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bot, Workflow, Store, Wrench, Settings, Activity,
} from 'lucide-react';

const items = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/marketplace', label: 'Marketplace', icon: Store },
  { to: '/mcp', label: 'MCP Tools', icon: Wrench },
  { to: '/status', label: 'Status', icon: Activity },
  { to: '/admin', label: 'Settings', icon: Settings },
];

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const crumb = items.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))?.label ?? 'App';

  return (
    <div className="min-h-screen">
      {/* Sub-nav bar */}
      <div className="sticky top-16 z-30 border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4 py-2">
            <nav
              aria-label="App sections"
              className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1"
            >
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      isActive
                        ? 'bg-primary/15 text-primary shadow-[0_0_20px_rgba(112,128,255,0.25)]'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="hidden md:block text-[10px] uppercase tracking-[0.25em] text-white/40">
              D3VONN.IO / <span className="text-primary">{crumb}</span>
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
};

export default AppShell;
