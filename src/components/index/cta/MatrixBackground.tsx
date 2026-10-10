
import React from 'react';
import { motion } from 'framer-motion';

interface MatrixBackgroundProps {
  particles: Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
  }>;
}

const MatrixBackground: React.FC<MatrixBackgroundProps> = ({ particles }) => {
  return (
    <div className="absolute inset-0 z-0">
      <img 
        src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5" 
        alt="Neural network visualization" 
        className="w-full h-full object-cover opacity-15"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-blue-600/90"></div>
      
      {/* Neural network nodes and connections */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nodeGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        
        {/* Random connections */}
        {Array.from({ length: 15 }, (_, i) => {
          const x1 = Math.random() * 100;
          const y1 = Math.random() * 100;
          const x2 = Math.random() * 100;
          const y2 = Math.random() * 100;
          
          return (
            <motion.line 
              key={`line-${i}`}
              x1={`${x1}%`} 
              y1={`${y1}%`} 
              x2={`${x2}%`} 
              y2={`${y2}%`} 
              stroke="rgba(255,255,255,0.1)" 
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 2 + Math.random() * 3, delay: Math.random() * 2, ease: "easeInOut" }}
            />
          );
        })}
        
        {/* Nodes */}
        {Array.from({ length: 20 }, (_, i) => {
          const x = Math.random() * 100;
          const y = Math.random() * 100;
          const size = 3 + Math.random() * 5;
          
          return (
            <motion.circle 
              key={`node-${i}`}
              cx={`${x}%`} 
              cy={`${y}%`} 
              r={size} 
              fill="url(#nodeGradient)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: [0, 1, 1, 0.8, 1], 
                opacity: [0, 0.5, 0.8, 0.5, 0.7] 
              }}
              transition={{ 
                duration: 4 + Math.random() * 5, 
                repeat: Infinity, 
                delay: Math.random() * 2,
                repeatType: "reverse" 
              }}
            />
          );
        })}
      </svg>

      {/* Animated particles */}
      {particles.map(particle => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 rounded-full bg-white"
          style={{ left: `${particle.x}%`, top: `${particle.y}%` }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.7, 0],
            scale: [0, 1, 0]
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay
          }}
        />
      ))}
      
      {/* Pulsing highlight circles */}
      <div className="absolute left-1/4 bottom-1/4 w-32 h-32 rounded-full bg-blue-400/5 blur-2xl"></div>
      <motion.div 
        className="absolute right-1/4 top-1/4 w-64 h-64 rounded-full bg-primary/10 blur-3xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      ></motion.div>
    </div>
  );
};

export default MatrixBackground;
