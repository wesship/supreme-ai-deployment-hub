
"use client"

import React, { useEffect, useRef } from 'react';

interface MatrixRainProps {
  className?: string;
  speed?: number;
  density?: number;
  color?: string;
  glowColor?: string;
  size?: number;
  opacity?: number;
  glowIntensity?: number;
}

export const MatrixRain: React.FC<MatrixRainProps> = ({
  className = "",
  speed = 1,
  density = 0.8,
  color = "#7080FF",
  glowColor = "#00FF41",
  size = 14,
  opacity = 0.9,
  glowIntensity = 3
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Resize canvas to full window
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Extended Matrix character set for variety
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
    
    // Calculate columns based on font size
    const fontSize = size;
    const columns = Math.floor(canvas.width / fontSize * density);
    
    // Array to track the y position and brightness of each column
    const drops: number[] = [];
    const brightness: number[] = [];
    
    // Initialize drops
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * -canvas.height);
      brightness[i] = 0.5 + Math.random() * 0.5;
    }
    
    // Drawing function
    const draw = () => {
      // Set semi-transparent black background to create fade effect with longer trails
      ctx.fillStyle = `rgba(0, 0, 0, ${0.03 / speed})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Loop through each drop
      for (let i = 0; i < drops.length; i++) {
        // Choose a random character
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        
        // Draw glow layers for intense effect
        ctx.save();
        ctx.globalAlpha = opacity * brightness[i] * 0.15;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 25 * glowIntensity;
        ctx.fillStyle = glowColor;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillText(text, x, y);
        ctx.restore();
        
        // Second glow layer
        ctx.save();
        ctx.globalAlpha = opacity * brightness[i] * 0.3;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15 * glowIntensity;
        ctx.fillStyle = glowColor;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillText(text, x, y);
        ctx.restore();
        
        // Main bright character (head of the stream)
        ctx.save();
        ctx.globalAlpha = opacity * brightness[i];
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 8 * glowIntensity;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillText(text, x, y);
        ctx.restore();
        
        // Trail characters with gradient fade
        for (let j = 1; j < 8; j++) {
          const trailY = y - j * fontSize;
          if (trailY > 0) {
            const trailChar = chars[Math.floor(Math.random() * chars.length)];
            const trailOpacity = (1 - j / 8) * opacity * brightness[i] * 0.7;
            
            ctx.save();
            ctx.globalAlpha = trailOpacity;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = (8 - j) * glowIntensity;
            ctx.fillStyle = color;
            ctx.font = `${fontSize}px monospace`;
            ctx.fillText(trailChar, x, trailY);
            ctx.restore();
          }
        }
        
        // Move the drop down
        drops[i]++;
        
        // Randomly update brightness for shimmer effect
        if (Math.random() > 0.95) {
          brightness[i] = 0.5 + Math.random() * 0.5;
        }
        
        // Randomly reset some drops to create continuous flow
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = -1;
        }
      }
    };
    
    // Animation loop - faster for smoother animation
    const interval = setInterval(draw, 25 / speed);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [color, glowColor, size, speed, density, opacity, glowIntensity]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={`fixed top-0 left-0 w-full h-full -z-10 pointer-events-none ${className}`}
      style={{ 
        filter: `drop-shadow(0 0 10px ${glowColor}40)` 
      }}
    />
  );
};
