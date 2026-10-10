
import React from 'react';
import { Bot, Globe, Activity, Minimize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatHeaderProps {
  onMinimize: () => void;
  onShowAPIStatus: () => void;
  onShowProcessMonitor: () => void;
  onClearConversation: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onMinimize,
  onShowAPIStatus,
  onShowProcessMonitor,
  onClearConversation
}) => {
  return (
    <div className="flex items-center justify-between p-3 border-b">
      <div className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-sm">D3VONN.IO Assistant</h3>
          <p className="text-xs text-muted-foreground">AI-powered help</p>
        </div>
      </div>
      <div className="flex items-center space-x-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={onShowAPIStatus}
          aria-label="API Status"
        >
          <Globe className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={onShowProcessMonitor}
          aria-label="Process Monitor"
        >
          <Activity className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={onMinimize}
          aria-label="Minimize"
        >
          <Minimize2 className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={onClearConversation}
          aria-label="Clear conversation"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatHeader;
