import { CSSProperties } from 'react';
import { Variants } from 'framer-motion';

// Basic animation variants
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any }
  }
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as any
    }
  }
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as any
    }
  }
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as any
    }
  }
};

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as any
    }
  }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as any
    }
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Enhanced stagger with customizable delay and stagger amount
export const staggerWithConfig = (staggerAmount = 0.1, initialDelay = 0) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: initialDelay,
      staggerChildren: staggerAmount
    }
  }
});

// Utility function to add staggered animations to children
export const staggerChildren = (delayIncrement = 0.1) => {
  return (index: number): CSSProperties => ({
    animationDelay: `${index * delayIncrement}s`,
    opacity: 0,
    animation: 'slide-up 0.6s ease-out forwards',
  });
};
