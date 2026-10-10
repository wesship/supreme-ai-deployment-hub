import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '@/contexts/ChatContext';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  type?: 'text' | 'buttons';
  buttons?: Array<{
    id: string;
    label: string;
    action: () => void;
  }>;
}

const ChatUI = () => {
  const { sendMessage } = useChat();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your AI assistant. How can I help you today?",
      sender: 'agent',
      timestamp: new Date(),
      type: 'buttons',
      buttons: [
        { id: '1', label: 'Deployment Help', action: () => handleButtonClick('I need help with deployment') },
        { id: '2', label: 'API Integration', action: () => handleButtonClick('How to integrate APIs?') },
        { id: '3', label: 'System Status', action: () => handleButtonClick('Show me the system status') }
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleButtonClick = (message: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    };
    
    setMessages(prev => [...prev, userMessage]);
    handleSendMessage(message);
  };
  
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Clear input if it's from the input field
    if (text === input) {
      setInput('');
    }

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        content: "I'm processing your request. Here are some options:",
        timestamp: new Date(),
        type: 'buttons',
        buttons: [
          { 
            id: 'resp1', 
            label: 'Learn More', 
            action: () => handleButtonClick('Tell me more about this topic')
          },
          { 
            id: 'resp2', 
            label: 'See Documentation', 
            action: () => handleButtonClick('Show me the documentation')
          }
        ]
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };
  
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.info('Voice recording started...');
    } else {
      toast.info('Voice recording stopped');
    }
  };
  
  return (
    <Card className="w-full max-w-[400px] h-[600px] flex flex-col fixed bottom-20 right-5 z-50">
      <CardHeader>
        <CardTitle>AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(600px-8rem)]">
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`flex items-start max-w-[80%] ${
                    message.sender === 'user'
                      ? 'flex-row-reverse'
                      : 'flex-row'
                  }`}
                >
                  <Avatar className={`h-8 w-8 ${message.sender === 'user' ? 'ml-2' : 'mr-2'}`}>
                    <div className={`w-full h-full flex items-center justify-center ${
                      message.sender === 'agent' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {message.sender === 'user' ? 'U' : 'AI'}
                    </div>
                  </Avatar>
                  <div
                    className={`p-3 rounded-lg ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                    
                    {message.type === 'buttons' && message.buttons && (
                      <div className="mt-2 space-y-2">
                        {message.buttons.map((button) => (
                          <Button
                            key={button.id}
                            variant="secondary"
                            size="sm"
                            className="w-full text-left"
                            onClick={button.action}
                          >
                            {button.label}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    <div className={`text-xs mt-1 ${
                      message.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={endOfMessagesRef} />
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="flex w-full items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleRecording}
            className={isRecording ? 'text-red-500' : ''}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(input);
              }
            }}
          />
          <Button onClick={() => handleSendMessage(input)} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ChatUI;
