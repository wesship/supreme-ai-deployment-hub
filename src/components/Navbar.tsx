
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

import Logo from './navigation/Logo';
import DesktopNav from './navigation/DesktopNav';
import ThemeToggle from './navigation/ThemeToggle';
import MobileMenu from './navigation/MobileMenu';
import { navigationItems } from './navigation/navigationItems';

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
      
      // Set isScrolled for style changes
      if (currentScrollPos > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
      
      // Hide/show navbar based on scroll direction
      const isScrolledDown = prevScrollPos < currentScrollPos;
      const isScrollSignificant = Math.abs(prevScrollPos - currentScrollPos) > 10;
      
      // Only hide when scrolling down significantly and not at the top
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
            ? 'border-b border-primary/20 bg-black/80 backdrop-blur-md'
            : 'bg-transparent',
          isScrolled && 'shadow-[0_0_15px_hsl(var(--primary)/0.18)]',
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
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <a
                href="https://github.com/devonn-ai/framework"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:rounded-lg"
                aria-label="GitHub Repository"
              >
                <Github className="h-5 w-5" />
              </a>
              
              {/* Mobile menu */}
              {isMobile && (
                <MobileMenu navigationItems={navigationItems} />
              )}
            </div>
          </div>
        </div>
        
        {/* Gradient border effect when scrolled */}
        {isScrolled && (
          <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent w-full" />
        )}
      </motion.header>
    </AnimatePresence>
  );
};

export default Navbar;
