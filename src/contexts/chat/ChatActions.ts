
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Message, ConversationContext } from './types';
import { SpeechHandler } from './SpeechHandler';

interface ChatActionsDependencies {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  conversationContext: ConversationContext;
  setConversationContext: React.Dispatch<React.SetStateAction<ConversationContext>>;
  getDeploymentSummary?: () => any;
  isClusterConnected?: boolean;
  apiConfigs?: any[];
  isAnyAPIConnected?: boolean;
}

export const createChatActions = ({
  messages,
  setMessages,
  setIsProcessing,
  conversationContext,
  setConversationContext,
  getDeploymentSummary,
  isClusterConnected,
  apiConfigs,
  isAnyAPIConnected
}: ChatActionsDependencies) => {
  
  // Initialize speech handler
  const speechHandler = new SpeechHandler({
    onResult: (text) => {
      if (text.trim()) {
        sendMessage(text, false, true);
      }
    },
    onError: (error) => {
      toast.error(`Speech recognition error: ${error}`);
    }
  });

  // Send a message
  const sendMessage = (text: string, speak = false, fromVoice = false) => {
    if (!text.trim()) return;
    
    // If this is a request to speak text, don't add it as a user message
    if (speak) {
      speechHandler.speak(text);
      return;
    }
    
    const userMessage: Message = {
      id: uuidv4(),
      sender: 'user',
      content: text,
      timestamp: new Date(),
      type: 'text',
      fromVoice
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    // Mock AI response logic
    setTimeout(() => {
      // Generate context-aware response
      const response = createMockResponse(text, {
        deploymentInfo: getDeploymentSummary?.() || null,
        isConnected: isClusterConnected || false,
        apis: apiConfigs || [],
        hasApiConnection: isAnyAPIConnected || false,
        context: conversationContext
      });
      
      const aiMessage: Message = {
        id: uuidv4(),
        sender: 'ai',
        content: response,
        timestamp: new Date(),
        type: 'text'
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsProcessing(false);
      
      // Update conversation context
      updateConversationContext(text, response);
    }, 1000);
  };

  // Update the conversation context based on messages
  const updateConversationContext = (userMessage: string, aiResponse: string) => {
    // Basic topic detection logic
    let topic = '';
    
    if (userMessage.toLowerCase().includes('deploy')) {
      topic = 'deployment';
    } else if (userMessage.toLowerCase().includes('api')) {
      topic = 'api';
    } else if (userMessage.toLowerCase().includes('help')) {
      topic = 'help';
    }
    
    if (topic) {
      setConversationContext(prev => ({
        ...prev,
        topic,
        recentTopics: [...(prev.recentTopics || []), topic].slice(-3)
      }));
    }
  };

  // Generate mock AI responses
  const createMockResponse = (userMessage: string, context: any) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return "Hello! I'm D3VONN.IO's assistant. How can I help you today?";
    }
    
    if (lowerMessage.includes('deploy')) {
      if (context.isConnected) {
        return "Your deployment system is connected. You currently have 3 deployments running. Would you like to see their status?";
      } else {
        return "I see you want to deploy something. First, you'll need to connect to a deployment cluster. Would you like me to help you with that?";
      }
    }
    
    if (lowerMessage.includes('api')) {
      if (context.hasApiConnection) {
        return `You have ${context.apis.length} API connections configured. Is there a specific API you want to manage?`;
      } else {
        return "You don't have any API connections set up yet. Would you like to configure one?";
      }
    }
    
    if (lowerMessage.includes('help')) {
      return "I can help you with deployments, API management, and general questions about D3VONN.IO. What specific area do you need assistance with?";
    }
    
    // Default response
    return "I understand. Is there anything specific about D3VONN.IO that you'd like to know more about?";
  };
  
  // Provide feedback on a message
  const provideFeedback = (messageId: string, isPositive: boolean) => {
    // Implement feedback logic here
    toast.success(`Feedback ${isPositive ? 'positive' : 'negative'} recorded. Thank you!`);
  };
  
  // Clear the conversation
  const clearConversation = () => {
    setMessages([]);
    toast.info("Conversation cleared");
    
    // Reset context
    setConversationContext({
      userPreferences: {
        detailLevel: 'basic',
        showExamples: true
      }
    });
  };
  
  // Start voice input
  const startVoiceInput = () => {
    speechHandler.startListening();
  };
  
  // Stop speech output
  const stopSpeaking = () => {
    speechHandler.stopSpeaking();
  };
  
  // Check if speech is supported
  const isSpeechSupported = () => {
    const voiceInput = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
    const voiceOutput = !!window.speechSynthesis;
    
    return { voiceInput, voiceOutput };
  };
  
  return {
    sendMessage,
    provideFeedback,
    clearConversation,
    startVoiceInput,
    stopSpeaking,
    isSpeechSupported
  };
};
