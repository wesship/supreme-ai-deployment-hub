import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Command, Lock, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuthState } from '@/hooks/useAuthState';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { NavButton } from './NavButton';
import SmartLaunchLink from '@/components/SmartLaunchLink';

interface MobileMenuProps {
  navigationItems: Array<{ name: string; path: string; protected?: boolean }>;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ navigationItems }) => {
  const location = useLocation();
  const authed = useAuthState();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <NavButton
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          className="min-h-11 min-w-11 rounded-xl border border-blue-300/15 bg-blue-400/[0.06] text-blue-100 hover:bg-blue-400/[0.12]"
        >
          <span className="sr-only">Open menu</span>
          <span className="flex flex-col gap-1.5" aria-hidden="true">
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
          </span>
        </NavButton>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[92vw] max-w-md border-l border-blue-300/15 bg-[#020714]/96 p-0 text-white shadow-[-30px_0_80px_rgba(0,15,45,0.45)] backdrop-blur-2xl"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 pb-5 pt-6">
            <div className="flex items-start justify-between gap-4">
              <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="D3VONN.IO home">
                <img
                  src="/d3vonn-logo.webp"
                  alt="D3VONN.IO"
                  className="h-12 w-auto max-w-[230px] object-contain object-left drop-shadow-[0_0_20px_rgba(59,130,246,0.45)]"
                />
              </Link>
              <SheetClose asChild>
                <NavButton
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  className="min-h-11 min-w-11 rounded-xl border border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </NavButton>
              </SheetClose>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-300/15 bg-blue-400/[0.055] p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/70">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                EXU Intelligence Gateway
              </div>
              <p className="mt-2 text-sm font-semibold text-white">One Platform. Infinite Intelligence.</p>
              <p className="mt-1 text-xs leading-5 text-white/45">
                Enter the AI Business Operating System through the path that matches your objective.
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <nav aria-label="Mobile primary navigation" className="space-y-2">
              {navigationItems.map((item) => {
                // Fail closed: while useAuthState is still resolving (authed === null)
                // a protected item must route through /login, same as the
                // confirmed-unauthenticated case. Only `authed === true` bypasses it.
                const needsAuth = item.protected && authed !== true;
                const target = needsAuth
                  ? `/login?redirect=${encodeURIComponent(item.path)}`
                  : item.path;
                const active = location.pathname === item.path;

                return (
                  <SheetClose asChild key={item.name}>
                    <Link
                      to={target}
                      className={cn(
                        'group flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all',
                        active
                          ? 'border-blue-300/30 bg-blue-400/10 text-white shadow-[inset_3px_0_0_rgba(147,197,253,0.9),0_0_24px_rgba(37,126,255,0.10)]'
                          : 'border-white/[0.07] bg-white/[0.025] text-white/66 hover:border-blue-300/20 hover:bg-blue-400/[0.06] hover:text-white'
                      )}
                    >
                      <span>{item.name}</span>
                      <span className="flex items-center gap-2">
                        {needsAuth && <Lock className="h-3.5 w-3.5 text-white/35" aria-hidden="true" />}
                        <ArrowRight className="h-4 w-4 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-200" aria-hidden="true" />}
                      </span>
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <SheetClose asChild>
                <Link
                  to="/command-center"
                  className="flex min-h-20 flex-col justify-between rounded-2xl border border-blue-300/15 bg-blue-400/[0.05] p-4 text-left"
                >
                  <Command className="h-5 w-5 text-blue-200" aria-hidden="true" />
                  <span className="text-xs font-semibold text-white">Command Nexus</span>
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  to="/security"
                  className="flex min-h-20 flex-col justify-between rounded-2xl border border-blue-300/15 bg-blue-400/[0.05] p-4 text-left"
                >
                  <ShieldCheck className="h-5 w-5 text-blue-200" aria-hidden="true" />
                  <span className="text-xs font-semibold text-white">Trust Center</span>
                </Link>
              </SheetClose>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">
              <SheetClose asChild>
                <Link
                  to="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-semibold text-white/80"
                >
                  Log In
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <SmartLaunchLink
                  authedTo="/app"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white shadow-[0_0_28px_rgba(37,126,255,0.35)]"
                >
                  Launch App
                </SmartLaunchLink>
              </SheetClose>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;
