import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, Search, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

import Logo from './navigation/Logo';
import DesktopNav from './navigation/DesktopNav';
import MobileMenu from './navigation/MobileMenu';
import { navigationItems } from './navigation/navigationItems';
import D3CommandPalette, { openD3CommandPalette } from './navigation/D3CommandPalette';
import './navigation/d3-command-deck.css';
import SmartLaunchLink from '@/components/SmartLaunchLink';

interface NavbarProps {
  className?: string;
  transparent?: boolean;
}

const Navbar = ({
  className,
  transparent = false,
}: NavbarProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isScrolled, setIsScrolled] = useState(false);
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY;
      setIsScrolled(currentScrollPos > 10);

      const isScrolledDown = prevScrollPos < currentScrollPos;
      const isScrollSignificant = Math.abs(prevScrollPos - currentScrollPos) > 10;
      setVisible(!(isScrolledDown && isScrollSignificant && currentScrollPos > 100));
      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevScrollPos]);

  return (
    <>
      <AnimatePresence>
        <motion.header
          className={cn(
            'fixed top-0 z-40 w-full transition-all duration-300',
            isScrolled || !transparent
              ? 'border-b border-blue-300/15 bg-[#020714]/88 shadow-[0_18px_60px_rgba(0,10,35,0.28)] backdrop-blur-2xl'
              : 'bg-gradient-to-b from-[#010611]/86 via-[#010611]/45 to-transparent backdrop-blur-sm',
            visible ? 'translate-y-0' : '-translate-y-full',
            className
          )}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between gap-4 lg:h-[72px]">
              <div className="flex min-w-0 items-center gap-4">
                <Logo />
                <div className="hidden h-7 w-px bg-gradient-to-b from-transparent via-blue-200/20 to-transparent 2xl:block" />
                <div className="hidden 2xl:block">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-200/45">D3 Intelligence Gateway</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">One Platform · Coordinated Intelligence</p>
                </div>
              </div>

              {!isMobile && (
                <DesktopNav navigationItems={navigationItems} currentPath={location.pathname} />
              )}

              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to="/security"
                  aria-label="Open Security and Trust Center"
                  className="hidden min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs font-semibold text-white/55 transition hover:border-blue-300/20 hover:bg-blue-400/[0.06] hover:text-blue-100 xl:inline-flex"
                >
                  <ShieldCheck className="h-4 w-4 text-blue-200/70" aria-hidden="true" />
                  Trust
                </Link>

                <button
                  type="button"
                  onClick={openD3CommandPalette}
                  title="Command Nexus (⌘K or Ctrl+K)"
                  className="d3-command-surface inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-300/20 bg-blue-400/[0.065] px-3 text-sm font-medium text-blue-50 transition hover:border-blue-300/45 hover:bg-blue-400/[0.12]"
                >
                  <Search className="h-4 w-4 text-blue-200" aria-hidden="true" />
                  <span className="hidden lg:inline">Command Nexus</span>
                  <span className="hidden rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-white/45 xl:inline">⌘K</span>
                </button>

                <Link
                  to="/login"
                  className="hidden min-h-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] px-4 text-sm font-medium text-white/72 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white sm:inline-flex"
                >
                  Log In
                </Link>

                <SmartLaunchLink
                  authedTo="/app"
                  className="hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-[0_0_26px_rgba(37,126,255,0.34)] transition hover:bg-blue-600 hover:shadow-[0_0_36px_rgba(37,126,255,0.48)] sm:inline-flex"
                >
                  <Command className="h-4 w-4" aria-hidden="true" />
                  Launch App
                </SmartLaunchLink>

                {isMobile && <MobileMenu navigationItems={navigationItems} />}
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-300/35 to-transparent" />
        </motion.header>
      </AnimatePresence>
      <D3CommandPalette />
    </>
  );
};

export default Navbar;
