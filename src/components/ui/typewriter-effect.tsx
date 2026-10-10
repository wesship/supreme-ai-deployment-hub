
"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TypewriterEffectProps {
  text: string | string[];
  className?: string;
  cursorClassName?: string;
  speed?: number;
  delay?: number;
}

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  text,
  className,
  cursorClassName,
  speed = 50,
  delay = 0,
}) => {
  const [displayText, setDisplayText] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  
  const textLines = Array.isArray(text) ? text : [text];

  useEffect(() => {
    // Initial delay before starting
    const initialTimer = setTimeout(() => {
      setIsTyping(true);
    }, delay);
    
    return () => clearTimeout(initialTimer);
  }, [delay]);
  
  useEffect(() => {
    if (!isTyping) return;
    
    if (lineIndex < textLines.length) {
      const currentLine = textLines[lineIndex];
      
      if (charIndex < currentLine.length) {
        // Type next character
        const timer = setTimeout(() => {
          setDisplayText(prev => prev + currentLine[charIndex]);
          setCharIndex(charIndex + 1);
        }, speed);
        
        return () => clearTimeout(timer);
      } else {
        // Line complete, add newline and move to next line
        if (lineIndex < textLines.length - 1) {
          const lineBreakTimer = setTimeout(() => {
            setDisplayText(prev => prev + "\n");
            setLineIndex(lineIndex + 1);
            setCharIndex(0);
          }, speed * 3); // Longer pause at end of line
          
          return () => clearTimeout(lineBreakTimer);
        }
      }
    }
  }, [isTyping, charIndex, lineIndex, textLines, speed]);
  
  // Split the display text by newlines to render multiple lines
  const lines = displayText.split('\n');
  
  return (
    <div className={cn("font-mono", className)}>
      {lines.map((line, idx) => (
        <div key={idx} className="flex">
          <span>{line}</span>
          {idx === lines.length - 1 && (
            <span className={cn("ml-0.5 animate-pulse", cursorClassName)}>_</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default TypewriterEffect;
