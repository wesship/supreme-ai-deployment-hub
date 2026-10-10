
import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onVoiceInput: () => void;
  isProcessing: boolean;
  speechSupport: {
    voiceInput: boolean;
    voiceOutput: boolean;
  };
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onVoiceInput,
  isProcessing,
  speechSupport
}) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    onSendMessage(input);
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t">
      <div className="flex space-x-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something..."
          className="min-h-10 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        
        {speechSupport.voiceInput && (
          <Button 
            type="button" 
            variant={isProcessing ? "outline" : "ghost"}
            size="icon"
            onClick={onVoiceInput}
            disabled={isProcessing}
            className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}
        
        <Button type="submit" size="icon" disabled={isProcessing || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
      {(speechSupport.voiceInput || speechSupport.voiceOutput) && (
        <div className="flex pt-2 text-xs text-muted-foreground">
          {speechSupport.voiceInput && (
            <Badge variant="outline" className="mr-1 py-0">Voice input</Badge>
          )}
          {speechSupport.voiceOutput && (
            <Badge variant="outline" className="py-0">Voice output</Badge>
          )}
        </div>
      )}
    </form>
  );
};

export default ChatInput;
