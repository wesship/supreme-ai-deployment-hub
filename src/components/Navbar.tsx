
import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

import Logo from './navigation/Logo';
import DesktopNav from './navigation/DesktopNav';
import MobileMenu from './navigation/MobileMenu';
import { navigationItems } from './navigation/navigationItems';
import SmartLaunchLink from '@/components/SmartLaunchLink';

interface NavbarProps {
  className?: string;
  transparent?: boolean;
}

const Navbar = ({ 
  className, 
  transparent = false 
}: NavbarProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    const openCommandNexus = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((event.key === '/' && !isTyping) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        navigate('/command-center');
      }
    };
    window.addEventListener('keydown', openCommandNexus);
    return () => window.removeEventListener('keydown', openCommandNexus);
  }, [navigate]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY;
      
      if (currentScrollPos > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
      
      const isScrolledDown = prevScrollPos < currentScrollPos;
      const isScrollSignificant = Math.abs(prevScrollPos - currentScrollPos) > 10;
      
      if (isScrolledDown && isScrollSignificant && currentScrollPos > 100) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      
      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevScrollPos]);

  return (
    <AnimatePresence>
      <motion.header
        className={cn(
          'fixed top-0 w-full transition-all duration-300 z-40 supports-[backdrop-filter]:bg-[#020817]/75',
          isScrolled || !transparent
            ? 'border-b border-blue-500/20 bg-[#020817]/90 backdrop-blur-md'
            : 'bg-transparent',
          isScrolled && 'shadow-[0_0_15px_rgba(56,136,255,0.12)]',
          visible ? 'translate-y-0' : '-translate-y-full',
          className
        )}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo />
            
            {!isMobile && (
              <DesktopNav navigationItems={navigationItems} currentPath={location.pathname} />
            )}
            
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link
                to="/command-center"
                aria-label="Open Command Nexus"
                title="Command Nexus (⌘K or Ctrl+K)"
                className="d3-command-surface inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-300/20 bg-blue-400/[0.06] px-3 text-sm font-medium text-blue-50 hover:border-blue-300/45 hover:bg-blue-400/[0.12]"
              >
                <Search className="h-4 w-4 text-blue-200" aria-hidden="true" />
                <span className="hidden lg:inline">Command Nexus</span>
                <span className="hidden rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-white/45 xl:inline">⌘K</span>
              </Link>
              {/* Log In button */}
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white/30 transition-colors"
              >
                Log In
              </Link>

              {/* Launch App button */}
              <SmartLaunchLink
                authedTo="/app"
                className="hidden sm:inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(56,136,255,0.3)] hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(56,136,255,0.5)] transition-all"
              >
                Launch App
              </SmartLaunchLink>
              
              {/* Mobile menu */}
              {isMobile && (
                <MobileMenu navigationItems={navigationItems} />
              )}
            </div>
          </div>
        </div>
        
        {/* Gradient border effect when scrolled */}
        {isScrolled && (
          <div className="h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent w-full" />
        )}
      </motion.header>
    </AnimatePresence>
  );
};

export default Navbar;
