
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, StopCircle } from 'lucide-react';
import { useAgentSession } from '@/hooks/useAgentSession';
import AGUIStream from '@/components/agui/AGUIStream';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AgentChatInterfaceProps {
  title?: string;
  placeholder?: string;
  className?: string;
}

const AgentChatInterface: React.FC<AgentChatInterfaceProps> = ({
  title = "AI Agent",
  placeholder = "Enter your request...",
  className = ""
}) => {
  const { session, isProcessing, startAgent, stopAgent } = useAgentSession();
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Focus input on mount
  useEffect(() => {
    if (inputRef.current && !isProcessing) {
      inputRef.current.focus();
    }
  }, [isProcessing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;
    
    await startAgent(prompt);
    setPrompt('');
  };

  const handleStop = () => {
    stopAgent();
  };

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <Sparkles className="h-5 w-5 mr-2 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-hidden p-3">
        <ScrollArea className="h-full pr-4">
          {session && session.tokens && (
            <AGUIStream 
              tokens={session.tokens} 
              isProcessing={isProcessing} 
              className="min-h-[200px]"
            />
          )}
          
          {!session && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Start a conversation with the AI agent</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="pt-2">
        <form onSubmit={handleSubmit} className="flex w-full space-x-2">
          <Textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            className="flex-grow resize-none min-h-10"
            disabled={isProcessing}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          
          {isProcessing ? (
            <Button 
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleStop}
              title="Stop agent"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              type="submit"
              size="icon"
              disabled={!prompt.trim()}
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </CardFooter>
    </Card>
  );
};

export default AgentChatInterface;
