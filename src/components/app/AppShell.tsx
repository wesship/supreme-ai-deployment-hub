import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bot, Workflow, Store, Wrench, Settings, Activity, Command, ShieldCheck,
} from 'lucide-react';

const items = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/marketplace', label: 'Marketplace', icon: Store },
  { to: '/mcp', label: 'MCP Tools', icon: Wrench },
  { to: '/command-center', label: 'Command', icon: Command },
  { to: '/security', label: 'Security', icon: ShieldCheck },
  { to: '/status', label: 'Health', icon: Activity },
  { to: '/admin', label: 'Settings', icon: Settings },
];

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const crumb = items.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))?.label ?? 'App';

  return (
    <div className="d3-os-shell min-h-screen">
      <div className="sticky top-16 z-30 border-b border-white/10 bg-black/75 backdrop-blur-xl supports-[backdrop-filter]:bg-black/60">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between gap-4 py-2">
            <nav
              aria-label="D3VONN.IO app sections"
              className="-mx-1 flex min-w-0 flex-1 snap-x snap-mandatory items-center gap-1 overflow-x-auto px-1 scrollbar-none"
            >
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 snap-start items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      isActive
                        ? 'bg-primary/15 text-primary shadow-[0_0_20px_rgba(112,128,255,0.25)]'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="hidden shrink-0 md:block text-[10px] uppercase tracking-[0.25em] text-white/40">
              <span aria-label={`Current workspace: ${crumb}`}>
                D3VONN.IO / <span className="text-primary">{crumb}</span>
              </span>
              <span className="ml-4 inline-flex items-center gap-1.5 text-blue-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-300 shadow-[0_0_8px_currentColor]" aria-hidden="true" />
                Workspace active
              </span>
            </div>
          </div>

          <div className="pb-2 md:hidden" aria-live="polite">
            <p className="truncate text-[10px] uppercase tracking-[0.2em] text-white/40">
              Current workspace <span className="text-primary">{crumb}</span>
            </p>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
};

export default AppShell;
