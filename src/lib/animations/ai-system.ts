
// Self-healing pulse animation for AI systems
export const selfHealingPulse = {
  initial: { boxShadow: "0 0 0 0 rgba(74, 222, 128, 0)" },
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(74, 222, 128, 0)",
      "0 0 0 10px rgba(74, 222, 128, 0.4)",
      "0 0 0 20px rgba(74, 222, 128, 0)",
    ],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      repeatType: "loop",
      ease: "easeInOut"
    }
  }
};

// Error detection animation for AI systems
export const errorDetection = {
  initial: { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0)" },
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(239, 68, 68, 0)",
      "0 0 0 10px rgba(239, 68, 68, 0.4)",
      "0 0 0 20px rgba(239, 68, 68, 0)",
    ],
    transition: {
      duration: 1.5,
      repeat: 3,
      repeatType: "loop",
      ease: "easeInOut"
    }
  }
};

// Self-correction animation
export const selfCorrection = {
  initial: { scale: 1, borderColor: "rgba(239, 68, 68, 1)" },
  animate: {
    scale: [1, 0.95, 1.05, 1],
    borderColor: ["rgba(239, 68, 68, 1)", "rgba(239, 68, 68, 0.7)", "rgba(74, 222, 128, 0.7)", "rgba(74, 222, 128, 1)"],
    transition: {
      duration: 1.5,
      ease: "easeInOut"
    }
  }
};

// Cloud switching animation
export const cloudSwitch = {
  exit: { 
    x: -30, 
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: "easeIn"
    }
  },
  initial: { 
    x: 30, 
    opacity: 0 
  },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  }
};

// Voice wave animation for speech detection
export const voiceWave = {
  initial: { scaleY: 0.1 },
  animate: {
    scaleY: [0.1, 0.7, 0.3, 0.9, 0.2, 0.6, 0.1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      repeatType: "loop",
      ease: "easeInOut"
    }
  }
};

// Data flow animation for AI system visualization
export const dataFlow = {
  initial: { strokeDashoffset: 1000 },
  animate: {
    strokeDashoffset: 0,
    transition: {
      duration: 3,
      ease: "linear",
      repeat: Infinity
    }
  }
};

// System scan animation
export const systemScan = {
  initial: { scaleX: 0, opacity: 0.7 },
  animate: {
    scaleX: 1,
    opacity: [0.7, 0.9, 0.7],
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatType: "loop",
      ease: "easeInOut"
    }
  }
};

// AI thinking animation
export const aiThinking = {
  initial: { opacity: 0.5, scale: 0.9 },
  animate: {
    opacity: [0.5, 1, 0.5],
    scale: [0.9, 1, 0.9],
    transition: {
      duration: 1.8,
      repeat: Infinity,
      repeatType: "loop",
      ease: "easeInOut"
    }
  }
};
