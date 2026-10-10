
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import TypewriterEffect from '@/components/ui/typewriter-effect';

const InteractiveTerminal = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = document.getElementById('terminal')?.getBoundingClientRect();
      if (rect) {
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <motion.div
      id="terminal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="relative z-10 w-full max-w-[500px] mx-auto lg:mx-0"
    >
      <div className="rounded-xl p-1 bg-gradient-to-br from-[#00FF41]/20 via-[#00FF41]/10 to-[#00FF41]/20 shadow-xl shadow-[#00FF41]/10 overflow-hidden backdrop-blur-sm border border-[#00FF41]/20">
        <div className="bg-black/90 rounded-lg p-5">
          <div className="flex items-center mb-3">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="ml-3 text-xs font-mono text-[#00FF41]">d3vonn.io Framework</div>
          </div>
          
          <div className="rounded bg-black/70 p-4 backdrop-blur-sm border border-[#00FF41]/10">
            <pre className="text-xs sm:text-sm text-[#00FF41] font-mono overflow-x-auto">
              <TypewriterEffect 
                text={[
                  "$ initializing d3vonn.io framework...",
                  "Loading AI components...",
                  "Configuring neural networks...",
                  "System ready for deployment",
                  "$ _"
                ]}
                speed={50}
                delay={1000}
                cursorClassName="text-[#00FF41]"
              />
            </pre>
          </div>
          
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0,255,65,0.1) 0%, transparent 50%)`,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default InteractiveTerminal;
