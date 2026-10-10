
import React, { useRef, useEffect } from 'react';
import { AGUIToken } from '@/contexts/agui/AGUIContext';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';

interface AGUIStreamProps {
  tokens: AGUIToken[];
  isProcessing: boolean;
  className?: string;
}

const AGUIStream: React.FC<AGUIStreamProps> = ({ tokens, isProcessing, className = '' }) => {
  const streamEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll when new tokens arrive
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tokens]);

  if (!tokens || tokens.length === 0) {
    return null;
  }
  
  return (
    <div className={`font-mono text-sm overflow-y-auto ${className}`}>
      {tokens.map((token, index) => (
        <div key={index} className="mb-1">
          {token.type === 'thinking' && (
            <div className="flex items-center text-gray-500">
              <Spinner className="h-3 w-3 mr-2" />
              <span>{token.content || 'Thinking...'}</span>
            </div>
          )}
          
          {token.type === 'token' && (
            <span>{token.content}</span>
          )}
          
          {token.type === 'tool' && (
            <Card className="p-2 my-2 bg-gray-50 dark:bg-gray-900 border-l-4 border-blue-500">
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                Tool: {token.toolName}
              </div>
              
              {token.toolInput && (
                <div className="mt-1 text-xs">
                  <div>Input:</div>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-1 rounded overflow-x-auto">
                    {JSON.stringify(token.toolInput, null, 2)}
                  </pre>
                </div>
              )}
              
              {token.toolResult && (
                <div className="mt-1 text-xs">
                  <div>Result:</div>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-1 rounded overflow-x-auto">
                    {JSON.stringify(token.toolResult, null, 2)}
                  </pre>
                </div>
              )}
            </Card>
          )}
        </div>
      ))}
      
      {isProcessing && (
        <div className="flex items-center text-gray-500">
          <Spinner className="h-3 w-3 mr-2" />
          <span>Processing...</span>
        </div>
      )}
      
      <div ref={streamEndRef} />
    </div>
  );
};

export default AGUIStream;
