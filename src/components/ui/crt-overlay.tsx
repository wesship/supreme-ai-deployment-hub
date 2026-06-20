"use client"

import React from 'react';

interface CRTOverlayProps {
  className?: string;
  scanlineOpacity?: number;
  scanlineSize?: number;
  flickerIntensity?: number;
  rgbShift?: boolean;
  vignette?: boolean;
  noise?: boolean;
}

export const CRTOverlay: React.FC<CRTOverlayProps> = ({
  className = "",
  scanlineOpacity = 0.15,
  scanlineSize = 2,
  flickerIntensity = 0.03,
  rgbShift = true,
  vignette = true,
  noise = true
}) => {
  return (
    <div className={`fixed inset-0 pointer-events-none z-50 ${className}`}>
      {/* Scanlines */}
      <div 
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent ${scanlineSize}px,
            rgba(0, 0, 0, ${scanlineOpacity}) ${scanlineSize}px,
            rgba(0, 0, 0, ${scanlineOpacity}) ${scanlineSize * 2}px
          )`,
          animation: 'scanlines 0.1s linear infinite'
        }}
      />
      
      {/* Horizontal scan beam */}
      <div 
        className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#7080FF]/20 to-transparent"
        style={{
          animation: 'scanBeam 8s linear infinite'
        }}
      />
      
      {/* Screen flicker */}
      <div 
        className="absolute inset-0 bg-white mix-blend-overlay"
        style={{
          opacity: flickerIntensity,
          animation: 'flicker 0.15s infinite'
        }}
      />
      
      {/* RGB chromatic aberration shift */}
      {rgbShift && (
        <div 
          className="absolute inset-0 mix-blend-screen opacity-30"
          style={{
            background: 'linear-gradient(90deg, rgba(255,0,0,0.03) 0%, transparent 50%, rgba(0,0,255,0.03) 100%)',
            animation: 'rgbShift 4s ease-in-out infinite'
          }}
        />
      )}
      
      {/* Vignette effect */}
      {vignette && (
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.4) 100%)',
            pointerEvents: 'none'
          }}
        />
      )}
      
      {/* Screen curve reflection */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.3) 0%, transparent 50%)'
        }}
      />
      
      {/* Subtle noise texture */}
      {noise && (
        <div 
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            animation: 'noise 0.2s steps(2) infinite'
          }}
        />
      )}
      
      {/* CRT screen glow around edges */}
      <div 
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 100px rgba(112, 128, 255, 0.05), inset 0 0 50px rgba(112, 128, 255, 0.03)'
        }}
      />

      <style>{`
        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(${scanlineSize * 2}px); }
        }
        
        @keyframes scanBeam {
          0% { top: -2px; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        
        @keyframes flicker {
          0%, 100% { opacity: ${flickerIntensity}; }
          50% { opacity: ${flickerIntensity * 0.5}; }
          75% { opacity: ${flickerIntensity * 1.5}; }
        }
        
        @keyframes rgbShift {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-1px); }
          75% { transform: translateX(1px); }
        }
        
        @keyframes noise {
          0% { transform: translate(0, 0); }
          50% { transform: translate(-1%, -1%); }
          100% { transform: translate(1%, 1%); }
        }
      `}</style>
    </div>
  );
};

export default CRTOverlay;
