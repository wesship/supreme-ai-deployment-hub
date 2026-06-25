/**
 * D3VONN.IO Floating Chat Widget
 * Bottom-right persistent AI assistant — demo mode for guests, full mode for auth users.
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Minimize2, Maximize2, Loader2, StopCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDevonnChat } from '@/hooks/useDevonnChat';
import { supabase } from '@/integrations/supabase/client';
import { VoiceControls } from './VoiceControls';

interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  error?: boolean;
}

const DEMO_LIMIT = 3;

const DEMO_SYSTEM = `You are Devonn, the AI assistant for D3VONN.IO. You are in demo mode — keep responses brief (2-3 sentences max). After the user's ${DEMO_LIMIT}rd message, invite them to sign up for full access.`;

export const FloatingChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState<string | undefined>();
  const [demoCount, setDemoCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!userId;
  const config = isAuthenticated
    ? { model: 'gpt-4.1-mini' }
    : { model: 'gpt-4.1-nano' };

  const { messages, isStreaming, sendMessage, stopStreaming } = useDevonnChat({
    userId,
    config,
  });

  // Last assistant message for TTS
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant' && !m.streaming)?.content;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    if (!isAuthenticated && demoCount >= DEMO_LIMIT) return;

    setDemoCount(c => c + 1);
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLimitReached = !isAuthenticated && demoCount >= DEMO_LIMIT;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20"
            style={{
              background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 100%)',
              border: '1px solid rgba(59, 255, 122, 0.4)',
              boxShadow: '0 0 20px rgba(59, 255, 122, 0.15), 0 4px 20px rgba(0,0,0,0.5)',
            }}
            aria-label="Open Devonn AI Chat"
          >
            <MessageSquare className="w-6 h-6 text-green-400" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-green-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden ${
              isExpanded ? 'w-[480px] h-[600px]' : 'w-[360px] h-[480px]'
            }`}
            style={{
              background: 'linear-gradient(180deg, #070d1a 0%, #0a1628 100%)',
              border: '1px solid rgba(59, 255, 122, 0.2)',
              boxShadow: '0 0 40px rgba(59, 255, 122, 0.08), 0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'rgba(59, 255, 122, 0.15)' }}
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                    <span className="text-green-400 text-xs font-bold font-mono">D</span>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#070d1a]" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Devonn AI</p>
                  <p className="text-green-400/60 text-xs font-mono">
                    {isAuthenticated ? 'Full access' : 'Demo mode'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to="/chat"
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
                  title="Open full chat"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setIsExpanded(e => !e)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-green-500/20">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-400/60" />
                  </div>
                  <div>
                    <p className="text-white/70 text-sm font-medium">Ask Devonn anything</p>
                    <p className="text-white/30 text-xs mt-1">
                      {isAuthenticated
                        ? 'Deployments, agents, workflows, infrastructure...'
                        : 'Try a quick question — sign in for full access'}
                    </p>
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-green-500/15 border border-green-500/20 text-white'
                        : 'bg-white/5 border border-white/8 text-white/90'
                    } ${msg.error ? 'border-red-500/30 bg-red-500/10' : ''}`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    {msg.streaming && (
                      <span className="inline-block w-1.5 h-4 bg-green-400 ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Demo limit banner */}
            {isLimitReached && (
              <div
                className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs text-center"
                style={{
                  background: 'rgba(59, 255, 122, 0.06)',
                  border: '1px solid rgba(59, 255, 122, 0.2)',
                }}
              >
                <span className="text-green-400/80">Demo limit reached. </span>
                <Link to="/login" className="text-green-400 font-semibold hover:underline">
                  Sign in for unlimited access →
                </Link>
              </div>
            )}

            {/* Input */}
            <div
              className="px-3 pb-3 pt-2 border-t"
              style={{ borderColor: 'rgba(59, 255, 122, 0.1)' }}
            >
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(59, 255, 122, 0.15)',
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isLimitReached
                      ? 'Sign in to continue...'
                      : 'Ask Devonn...'
                  }
                  disabled={isLimitReached}
                  className="flex-1 bg-transparent text-white text-sm placeholder-white/25 focus-visible:outline-none focus-visible:shadow-focus-glow disabled:opacity-40"
                />
                {/* Voice controls */}
                <div className="flex-shrink-0">
                  <VoiceControls
                    lastAssistantMessage={lastAssistantMessage}
                    onTranscript={(text) => {
                      setInput(prev => prev + text + ' ');
                    }}
                    isStreaming={isStreaming}
                  />
                </div>

                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    className="p-1 rounded-lg text-red-400/70 hover:text-red-400 transition-colors"
                  >
                    <StopCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLimitReached}
                    className="p-1 rounded-lg text-green-400/60 hover:text-green-400 disabled:opacity-30 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-center text-white/15 text-[10px] mt-1.5 font-mono">
                D3VONN.IO · Supreme AI Deployment Hub
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingChatWidget;
