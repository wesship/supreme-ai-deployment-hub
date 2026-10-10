
import React, { createContext, ReactNode } from 'react';
import { toast } from 'sonner';
import { ChatContextType } from './types';

// Create a mock chat context for components that are used outside of ChatProvider
const initialMockContext: ChatContextType = {
  messages: [],
  processes: [],
  isProcessing: false,
  sendMessage: (text: string) => {
    toast.info("Chat functionality not available on this page");
    console.log("Chat message sent outside provider:", text);
  },
  provideFeedback: () => {
    console.log("Feedback not available outside ChatProvider");
  },
  clearConversation: () => {
    console.log("Clear conversation not available outside ChatProvider");
  },
  startVoiceInput: () => {
    toast.warning("Voice input not available on this page");
    console.log("Voice input triggered outside provider");
  },
  stopSpeaking: () => {
    console.log("Stop speaking not available outside ChatProvider");
  },
  isSpeechSupported: () => ({
    voiceInput: false,
    voiceOutput: false
  })
};

export const MockChatContext = createContext<ChatContextType>(initialMockContext);

export const MockChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <MockChatContext.Provider value={initialMockContext}>
      {children}
    </MockChatContext.Provider>
  );
};

// Helper hook to safely use chat context even outside the provider
export const useSafeChat = () => {
  const context = React.useContext(MockChatContext);
  return context;
};
