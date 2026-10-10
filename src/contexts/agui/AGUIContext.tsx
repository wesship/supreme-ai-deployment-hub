
import React, { createContext, useContext, useState, ReactNode } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

// Define AG-UI types
export interface AGUIToken {
  type: 'thinking' | 'token' | 'tool' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResult?: Record<string, any>;
}

export interface AGUISession {
  sessionId: string;
  isActive: boolean;
  tokens: AGUIToken[];
}

interface AGUIContextType {
  session: AGUISession | null;
  isProcessing: boolean;
  startSession: (prompt: string) => Promise<void>;
  endSession: () => void;
  submitToolResult: (toolName: string, result: any) => Promise<boolean>;
}

const AGUIContext = createContext<AGUIContextType | undefined>(undefined);

// API endpoints
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STREAM_ENDPOINT = `${API_BASE_URL}/agui/stream-token`;
const TOOL_RESULT_ENDPOINT = `${API_BASE_URL}/agui/tool-result`;

export const AGUIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AGUISession | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Start a new agent session
  const startSession = async (prompt: string): Promise<void> => {
    try {
      setIsProcessing(true);
      
      // Close any existing connection
      if (eventSource) {
        eventSource.close();
      }
      
      // Create a new session
      const sessionId = `session-${Date.now()}`;
      setSession({
        sessionId,
        isActive: true,
        tokens: [{
          type: 'thinking',
          content: 'Starting agent...'
        }]
      });
      
      // Connect to the token stream endpoint
      const params = new URLSearchParams({
        session_id: sessionId,
        prompt
      }).toString();
      
      const sse = new EventSource(`${STREAM_ENDPOINT}?${params}`);
      
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          setSession(prev => {
            if (!prev) return null;
            
            return {
              ...prev,
              tokens: [...prev.tokens, data]
            };
          });
          
          // If we receive a "done" message, close the connection
          if (data.type === 'done') {
            sse.close();
            setIsProcessing(false);
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };
      
      sse.onerror = (error) => {
        console.error('SSE connection error:', error);
        toast.error('Error connecting to agent stream');
        sse.close();
        setIsProcessing(false);
        
        setSession(prev => {
          if (!prev) return null;
          
          return {
            ...prev,
            isActive: false,
            tokens: [
              ...prev.tokens, 
              { type: 'done', content: 'Connection error. Please try again.' }
            ]
          };
        });
      };
      
      setEventSource(sse);
      
    } catch (error) {
      console.error('Error starting agent session:', error);
      toast.error('Failed to start agent session');
      setIsProcessing(false);
    }
  };

  // End the current session
  const endSession = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    
    setSession(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        isActive: false
      };
    });
    
    setIsProcessing(false);
  };

  // Submit tool results back to the agent
  const submitToolResult = async (toolName: string, result: any): Promise<boolean> => {
    if (!session) {
      toast.error('No active agent session');
      return false;
    }
    
    try {
      await axios.post(TOOL_RESULT_ENDPOINT, {
        session_id: session.sessionId,
        tool_name: toolName,
        result
      });
      
      // Add the tool result to the session tokens
      setSession(prev => {
        if (!prev) return null;
        
        return {
          ...prev,
          tokens: [
            ...prev.tokens,
            {
              type: 'tool',
              toolName,
              toolResult: result
            }
          ]
        };
      });
      
      return true;
    } catch (error) {
      console.error('Error submitting tool result:', error);
      toast.error('Failed to submit tool result');
      return false;
    }
  };

  return (
    <AGUIContext.Provider
      value={{
        session,
        isProcessing,
        startSession,
        endSession,
        submitToolResult
      }}
    >
      {children}
    </AGUIContext.Provider>
  );
};

export const useAGUI = (): AGUIContextType => {
  const context = useContext(AGUIContext);
  if (context === undefined) {
    throw new Error('useAGUI must be used within an AGUIProvider');
  }
  return context;
};
