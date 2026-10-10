
import React from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, Cpu, Bot, ZapIcon, NetworkIcon, DatabaseIcon } from 'lucide-react';

const FloatingIcons: React.FC = () => {
  return (
    <>
      {/* Floating AI elements with enhanced animations */}
      <motion.div 
        className="absolute top-10 left-10 text-white"
        animate={{ 
          y: [0, -10, 0],
          rotate: [0, 5, 0, -5, 0],
          scale: [1, 1.1, 1] 
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity,
          repeatType: "reverse" 
        }}
      >
        <BrainCircuit size={40} className="drop-shadow-lg" />
      </motion.div>
      
      <motion.div 
        className="absolute bottom-10 right-10 text-white"
        animate={{ 
          y: [0, 10, 0],
          rotate: [0, -5, 0, 5, 0],
          scale: [1, 1.05, 1] 
        }}
        transition={{ 
          duration: 7, 
          repeat: Infinity,
          repeatType: "reverse",
          delay: 1
        }}
      >
        <Cpu size={40} className="drop-shadow-lg" />
      </motion.div>
      
      <motion.div 
        className="absolute top-1/2 right-20 text-white"
        animate={{ 
          x: [0, 10, 0, -10, 0],
          rotate: [0, 10, 0, -10, 0] 
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity,
          repeatType: "reverse",
          delay: 0.5
        }}
      >
        <Bot size={40} className="drop-shadow-lg" />
      </motion.div>
      
      {/* Additional AI-themed floating icons */}
      <motion.div 
        className="absolute top-1/4 left-20 text-white"
        animate={{ 
          x: [0, -15, 0],
          y: [0, 10, 0],
          rotate: [0, -15, 0] 
        }}
        transition={{ 
          duration: 9, 
          repeat: Infinity,
          delay: 2.5
        }}
      >
        <ZapIcon size={30} className="drop-shadow-lg opacity-60" />
      </motion.div>
      
      <motion.div 
        className="absolute bottom-1/4 left-1/3 text-white"
        animate={{ 
          y: [0, -20, 0],
          scale: [1, 1.2, 1] 
        }}
        transition={{ 
          duration: 6, 
          repeat: Infinity,
          delay: 1.5
        }}
      >
        <NetworkIcon size={35} className="drop-shadow-lg opacity-50" />
      </motion.div>
      
      <motion.div 
        className="absolute top-1/3 right-1/4 text-white"
        animate={{ 
          rotate: [0, 360],
          scale: [1, 1.1, 1] 
        }}
        transition={{ 
          rotate: { duration: 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 5, repeat: Infinity, repeatType: "reverse" }
        }}
      >
        <DatabaseIcon size={25} className="drop-shadow-lg opacity-40" />
      </motion.div>
    </>
  );
};

export default FloatingIcons;
