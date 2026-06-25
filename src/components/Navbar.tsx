
import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [visible, setVisible] = useState(true);
  
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
          'fixed top-0 w-full transition-all duration-300 z-40',
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
            
            <div className="flex items-center space-x-3">
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
