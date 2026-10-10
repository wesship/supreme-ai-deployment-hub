
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface ResponseDisplayProps {
  response: string;
  status: string;
  onSaveResponse: () => void;
  hasValidResponse: boolean;
}

const ResponseDisplay: React.FC<ResponseDisplayProps> = ({
  response,
  status,
  onSaveResponse,
  hasValidResponse
}) => {
  const [copied, setCopied] = useState(false);
  
  const getStatusClass = () => {
    if (!status) return '';
    return status.startsWith('2') 
      ? 'status-success' 
      : 'status-error';
  };
  
  const copyToClipboard = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      toast.success('Response copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Response</h3>
        
        <div className="flex space-x-2">
          {hasValidResponse && (
            <>
              <Button 
                onClick={copyToClipboard} 
                variant="outline" 
                size="sm"
                className="gap-1"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              
              <Button 
                onClick={onSaveResponse} 
                variant="outline" 
                size="sm"
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                Save Response
              </Button>
            </>
          )}
        </div>
      </div>
      
      {status && (
        <div className={cn('text-sm px-3 py-1 rounded-md inline-block', getStatusClass())}>
          Status: {status}
        </div>
      )}
      
      <div className="bg-secondary rounded-md p-4 relative overflow-hidden border border-border/50">
        {!response && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Response will appear here
          </div>
        )}
        <pre className={cn(
          "font-mono text-sm whitespace-pre-wrap break-words min-h-[200px] max-h-[400px] overflow-auto",
          !response && "opacity-0"
        )}>
          {response || 'Response will appear here'}
        </pre>
      </div>
    </motion.div>
  );
};

export default ResponseDisplay;
