
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, MicOff, Send } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useChat } from '@/contexts/ChatContext';
import { SpeechHandler } from '@/contexts/chat/SpeechHandler';
import { Avatar } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const ChatInterface = () => {
  const { sendMessage, isProcessing, messages: contextMessages } = useChat();
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! How can I help you today?',
      sender: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [speechHandler, setSpeechHandler] = useState<SpeechHandler | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Check if speech recognition is supported
  const isSpeechSupported = () => {
    return {
      voiceInput: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
      voiceOutput: 'speechSynthesis' in window
    };
  };
  
  const speechSupport = isSpeechSupported();

  useEffect(() => {
    // Initialize speech handler if supported
    if (speechSupport.voiceInput) {
      const handler = new SpeechHandler({
        onStart: () => setIsListening(true),
        onEnd: () => setIsListening(false),
        onResult: (text) => {
          setTranscript(text);
          if (text.trim()) {
            setMessage(text);
          }
        },
        onInterim: (text) => setTranscript(text),
        onError: (error) => {
          handleSpeechError(error);
          setIsListening(false);
        }
      });
      
      setSpeechHandler(handler);
      
      return () => {
        if (handler) {
          handler.stopListening();
        }
      };
    }
  }, [speechSupport.voiceInput]);
  
  // Scroll to bottom of messages when new messages are added
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add new contextMessages to the messages array
  useEffect(() => {
    if (contextMessages && contextMessages.length > 0) {
      const newMessages = contextMessages.map(msg => ({
        id: msg.id || Date.now().toString(),
        content: msg.content,
        sender: msg.sender === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
        timestamp: new Date(msg.timestamp || Date.now())
      }));
      
      setMessages(prev => {
        // Only add messages that don't already exist
        const existingIds = new Set(prev.map(m => m.id));
        const messagesToAdd = newMessages.filter(m => !existingIds.has(m.id));
        
        if (messagesToAdd.length === 0) return prev;
        return [...prev, ...messagesToAdd];
      });
    }
  }, [contextMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      content: message,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    sendMessage(message);
    setMessage('');
  };

  const handleSpeechError = (error: string) => {
    console.error('Speech recognition error:', error);
    
    // Provide more user-friendly error messages
    let errorMessage = 'Speech recognition error';
    
    if (error === 'no-speech') {
      errorMessage = 'No speech detected. Please try again.';
    } else if (error === 'aborted') {
      errorMessage = 'Speech recognition was aborted';
    } else if (error === 'audio-capture') {
      errorMessage = 'Could not access your microphone. Please check permissions.';
    } else if (error === 'network') {
      errorMessage = 'Network error occurred during speech recognition';
    } else if (error === 'not-allowed') {
      errorMessage = 'Microphone access denied. Please allow microphone access.';
    } else if (error === 'service-not-allowed') {
      errorMessage = 'Speech recognition service not allowed';
    }
    
    toast.error(errorMessage);
    
    // Try to restart speech recognition after a network error
    if (error === 'network' && speechHandler) {
      setTimeout(() => {
        toast.info('Attempting to restart voice input...');
        toggleListening();
      }, 2000);
    }
  };

  const toggleListening = () => {
    if (!speechHandler) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }
    
    if (isListening) {
      speechHandler.stopListening();
      setIsListening(false);
    } else {
      speechHandler.startListening();
      toast.info('Listening for voice input...');
    }
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-full rounded-md border overflow-hidden">
      <div className="p-4 bg-primary/10 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Chat Assistant</h3>
        </div>
        {speechSupport.voiceInput && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={toggleListening}
            className={isListening ? "text-red-500" : ""}
          >
            {isListening ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
            {isListening ? "Stop" : "Voice"}
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-4 max-h-[400px]">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center mt-4">
              Start a conversation with the AI assistant
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`flex items-start gap-2 max-w-[80%] ${
                    msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <div className={`w-full h-full flex items-center justify-center ${
                      msg.sender === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {msg.sender === 'user' ? 'U' : 'AI'}
                    </div>
                  </Avatar>
                  
                  <div
                    className={`p-3 rounded-lg ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <div className="text-xs mt-1 opacity-70">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <form onSubmit={handleSubmit} className="p-4 border-t flex items-center space-x-2">
        <input
          type="text"
          value={transcript || message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
        />
        <Button type="submit" disabled={isProcessing || !message.trim()}>
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </form>
      
      {isListening && (
        <div className="p-2 bg-primary/5 border-t text-sm text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="relative">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping absolute" />
              <div className="w-2 h-2 bg-red-500 rounded-full" />
            </div>
            <span>{transcript ? transcript : "Listening..."}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
