
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useDeployment } from '../DeploymentContext';
import { useAPI } from '../APIContext';
import { ChatContextType } from './types';
import { useChatState } from './ChatState';
import { createChatActions } from './ChatActions';
import { MockChatContext } from './mockChatProvider';

// Create the context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider component
export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { getDeploymentSummary, isConnected: isClusterConnected } = useDeployment();
  const { apiConfigs, isAnyAPIConnected } = useAPI();
  
  const {
    messages,
    setMessages,
    processes,
    isProcessing,
    setIsProcessing,
    conversationContext,
    setConversationContext
  } = useChatState();

  const { 
    sendMessage, 
    provideFeedback, 
    clearConversation,
    startVoiceInput,
    stopSpeaking,
    isSpeechSupported
  } = createChatActions({
    messages,
    setMessages,
    setIsProcessing,
    conversationContext,
    setConversationContext,
    getDeploymentSummary,
    isClusterConnected,
    apiConfigs,
    isAnyAPIConnected
  });

  // Expose chat API through window object for external access
  useEffect(() => {
    const api = {
      sendMessage,
      getMessages: () => messages,
      clearConversation,
    };
    
    // @ts-ignore
    window.DevonnAIChat = api;
    
    return () => {
      // @ts-ignore
      delete window.DevonnAIChat;
    };
  }, [messages]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        processes,
        isProcessing,
        sendMessage,
        provideFeedback,
        clearConversation,
        startVoiceInput,
        stopSpeaking,
        isSpeechSupported,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook for using the chat context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Safe variant: returns the real chat context when available,
// falls back to the no-op mock context when used outside ChatProvider.
export const useSafeChat = (): ChatContextType => {
  const real = useContext(ChatContext);
  const mock = useContext(MockChatContext);
  return real ?? mock;
};

