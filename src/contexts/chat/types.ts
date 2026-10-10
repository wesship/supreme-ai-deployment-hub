export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'ai';
  content: string;
  timestamp: Date;
  type?: 'text' | 'buttons' | 'links' | 'image';
  buttons?: Array<{
    id: string;
    label: string;
    action: () => void;
  }>;
  links?: Array<{
    label: string;
    url: string;
  }>;
  imageUrl?: string;
  fromVoice?: boolean;
  feedback?: 'positive' | 'negative';
}

export interface Process {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'failed' | 'completed';
  progress: number;
  message: string;
  startTime: Date;
  endTime?: Date;
  priority?: string | number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface ConversationContext {
  topic?: string;
  recentTopics?: string[];
  userPreferences?: {
    detailLevel: 'basic' | 'detailed' | 'technical';
    showExamples: boolean;
  };
  lastIntent?: string;
  messageCount?: number;
  topicHistory?: string[];
  mentionedEntities?: Record<string, string[]>;
  failedIntentCount?: number;
  lastUserSentiment?: 'positive' | 'negative' | 'neutral';
}

export interface Intent {
  type: string;
  confidence: number;
  entities: Entity[];
}

export interface Entity {
  type: string;
  value: string;
  position: {
    start: number;
    end: number;
  };
}

export interface FallbackStrategy {
  threshold: number;
  responses: string[];
}

export interface ChatMessage {
  content: string;
  role: 'user' | 'assistant' | 'system';
  id?: string;
  sender?: 'user' | 'ai';
  timestamp?: Date;
  type?: 'text' | 'buttons' | 'links' | 'image';
  buttons?: Array<{
    id: string;
    label: string;
    action: () => void;
  }>;
  links?: Array<{
    label: string;
    url: string;
  }>;
  imageUrl?: string;
}

export interface ChatContextType {
  messages: Message[];
  processes: Process[];
  isProcessing: boolean;
  sendMessage: (text: string, speak?: boolean) => void;
  provideFeedback: (messageId: string, isPositive: boolean) => void;
  clearConversation: () => void;
  startVoiceInput: () => void;
  stopSpeaking: () => void;
  isSpeechSupported: () => {
    voiceInput: boolean;
    voiceOutput: boolean;
  };
}
