/**
 * useDevonnChat — core hook for Devonn.ai conversational AI
 * Powers both the FloatingWidget and the /chat workspace page.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { streamChat, ChatMessage, OrchestratorConfig } from '@/services/ai/orchestrator';
import {
  StoredMessage,
  Conversation,
  saveConversation,
  getConversations,
  generateTitle,
} from '@/services/ai/conversationStore';

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  provider?: string;
  model?: string;
  error?: boolean;
}

export interface UseDevonnChatOptions {
  userId?: string;
  conversationId?: string;
  config?: OrchestratorConfig;
  maxHistory?: number;
}

export function useDevonnChat(options: UseDevonnChatOptions = {}) {
  const { userId, config = {}, maxHistory = 20 } = options;

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(
    options.conversationId || uuidv4()
  );
  const [conversationTitle, setConversationTitle] = useState('New conversation');
  const abortRef = useRef<AbortController | null>(null);

  // Load conversation history on mount
  useEffect(() => {
    getConversations(userId).then(setConversations);
  }, [userId]);

  // Load a specific conversation
  const loadConversation = useCallback((conv: Conversation) => {
    setActiveConversationId(conv.id);
    setConversationTitle(conv.title);
    setMessages(
      conv.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.timestamp),
          provider: m.provider,
          model: m.model,
        }))
    );
  }, []);

  // Start a new conversation
  const newConversation = useCallback(() => {
    setActiveConversationId(uuidv4());
    setConversationTitle('New conversation');
    setMessages([]);
  }, []);

  // Persist current conversation
  const persistConversation = useCallback(
    async (msgs: UIMessage[], title: string) => {
      const stored: StoredMessage[] = msgs.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        provider: m.provider,
        model: m.model,
      }));

      const conv: Conversation = {
        id: activeConversationId,
        title,
        messages: stored,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId,
      };

      await saveConversation(conv, userId);
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === conv.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = conv;
          return updated;
        }
        return [conv, ...prev];
      });
    },
    [activeConversationId, userId]
  );

  // Send a message and stream the response
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: UIMessage = {
        id: uuidv4(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      const assistantId = uuidv4();
      const assistantMsg: UIMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        streaming: true,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages([...updatedMessages, assistantMsg]);
      setIsStreaming(true);

      // Update title from first user message
      let title = conversationTitle;
      if (messages.length === 0) {
        title = generateTitle(text);
        setConversationTitle(title);
      }

      // Build message history for LLM (trim to maxHistory)
      const history: ChatMessage[] = updatedMessages
        .slice(-maxHistory)
        .map(m => ({ role: m.role, content: m.content }));

      abortRef.current = new AbortController();
      let fullContent = '';
      let finalProvider = '';
      let finalModel = '';

      try {
        for await (const chunk of streamChat(history, { ...config, signal: abortRef.current.signal })) {
          if (chunk.error) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: `Error: ${chunk.error}`, streaming: false, error: true }
                  : m
              )
            );
            break;
          }

          fullContent += chunk.delta;
          if (chunk.provider) finalProvider = chunk.provider;
          if (chunk.model) finalModel = chunk.model;

          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId
                ? {
                    ...m,
                    content: fullContent,
                    streaming: !chunk.done,
                    provider: finalProvider,
                    model: finalModel,
                  }
                : m
            )
          );

          if (chunk.done) break;
        }
      } catch (err) {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: `Connection error: ${err}`, streaming: false, error: true }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        // Persist after streaming completes
        const finalMessages: UIMessage[] = [
          ...updatedMessages,
          {
            id: assistantId,
            role: 'assistant',
            content: fullContent,
            timestamp: new Date(),
            provider: finalProvider,
            model: finalModel,
          },
        ];
        await persistConversation(finalMessages, title);
      }
    },
    [messages, isStreaming, config, maxHistory, conversationTitle, persistConversation]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages(prev =>
      prev.map(m => (m.streaming ? { ...m, streaming: false } : m))
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    newConversation();
  }, [newConversation]);

  return {
    messages,
    isStreaming,
    conversations,
    activeConversationId,
    conversationTitle,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadConversation,
    newConversation,
  };
}
