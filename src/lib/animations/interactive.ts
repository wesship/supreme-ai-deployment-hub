import { Variants } from 'framer-motion';

// Page transition settings
export const pageTransition = {
  initial: { opacity: 0, y: 15 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as any,
      staggerChildren: 0.1
    }
  },
  exit: { 
    opacity: 0, 
    y: 15,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1] as any
    }
  }
};

// Card hover animations
export const cardHover: Variants = {
  rest: { 
    scale: 1,
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
  },
  hover: { 
    scale: 1.03,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    transition: {
      duration: 0.2,
      ease: "easeOut" as any
    }
  }
};

// Button hover animations
export const buttonHover: Variants = {
  rest: { scale: 1 },
  hover: { 
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: "easeOut" as any
    }
  },
  tap: { 
    scale: 0.95,
    transition: {
      duration: 0.1,
      ease: "easeOut" as any
    }
  }
};
