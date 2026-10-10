
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CodeDisplayProps {
  code: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
  highlight?: number[];
  animate?: boolean;
  title?: string;
  showCopyButton?: boolean;
}

const CodeDisplay = ({
  code,
  language = 'yaml',
  className,
  showLineNumbers = true,
  highlight = [],
  animate = false,
  title,
  showCopyButton = true
}: CodeDisplayProps) => {
  const [copied, setCopied] = useState(false);

  // Simple syntax highlighting functions
  const highlightCode = (code: string) => {
    if (language === 'yaml') {
      // Basic YAML highlighting
      return code
        .split('\n')
        .map((line, i) => {
          const lineNumber = i + 1;
          const isHighlighted = highlight.includes(lineNumber);
          
          // Highlight comments
          let highlightedLine = line.replace(
            /(#.*)$/g,
            '<span class="comment">$1</span>'
          );
          
          // Highlight keys
          highlightedLine = highlightedLine.replace(
            /^(\s*)([\w-]+):/g,
            '$1<span class="keyword">$2</span>:'
          );
          
          // Highlight strings
          highlightedLine = highlightedLine.replace(
            /'([^']*)'/g,
            '<span class="string">\'$1\'</span>'
          );
          
          return (
            <div 
              key={i} 
              className={cn(
                "code-line",
                isHighlighted && "bg-yellow-100/20"
              )}
            >
              {showLineNumbers && (
                <span className="inline-block w-8 mr-4 text-right text-gray-400">
                  {lineNumber}
                </span>
              )}
              <span dangerouslySetInnerHTML={{ __html: highlightedLine || '&nbsp;' }} />
            </div>
          );
        });
    }
    
    // Default simple highlighting
    return code.split('\n').map((line, i) => (
      <div key={i} className="code-line">
        {showLineNumbers && (
          <span className="inline-block w-8 mr-4 text-right text-gray-400">
            {i + 1}
          </span>
        )}
        <span>{line || '\u00A0'}</span>
      </div>
    ));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
  };

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const codeContent = (
    <div className={cn(
      "relative overflow-hidden rounded-lg bg-black/90 text-white font-mono text-sm",
      className
    )}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
          <div className="text-xs font-medium">{title}</div>
          {showCopyButton && (
            <button
              onClick={copyToClipboard}
              className="flex items-center rounded px-2 py-1 text-xs hover:bg-white/10 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      )}
      <div className="p-4 overflow-x-auto">
        <pre className="code-block">
          {highlightCode(code)}
        </pre>
      </div>
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {codeContent}
      </motion.div>
    );
  }

  return codeContent;
};

export default CodeDisplay;
