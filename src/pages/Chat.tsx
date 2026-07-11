/**
 * D3VONN.IO /chat — Full AI Workspace
 * Advanced conversation interface with history sidebar, streaming, auth gating, and agent mode.
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { FileUploadHandler } from '@/components/ai/FileUploadHandler';
import { AgentConsole } from '@/components/ai/AgentConsole';
import { VoiceControls } from '@/components/ai/VoiceControls';
import { IngestResult } from '@/services/ai/ragService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, StopCircle, Plus, Trash2, MessageSquare, ChevronLeft,
  ChevronRight, Loader2, Bot, User, Zap, Settings, Upload,
  Terminal, Brain, Activity
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useDevonnChat } from '@/hooks/useDevonnChat';
import { Conversation } from '@/services/ai/conversationStore';
import { supabase } from '@/integrations/supabase/client';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';

const SUGGESTED_PROMPTS = [
  'What is the current deployment status of the platform?',
  'Explain the D3VONN.IO multi-agent orchestration architecture',
  'How do I add a new agent to the marketplace?',
  'Show me how to configure a LangGraph workflow',
  'What are the EKS cluster health metrics?',
  'Help me debug a failing CI/CD pipeline',
];

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-mini');
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [lastIngestResult, setLastIngestResult] = useState<IngestResult | null>(null);
  const [agentConsoleCollapsed, setAgentConsoleCollapsed] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/login?redirect=/chat');
        return;
      }
      setUserId(data.session.user.id);
      setUserEmail(data.session.user.email);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login?redirect=/chat');
      else {
        setUserId(session.user.id);
        setUserEmail(session.user.email);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  const {
    messages,
    isStreaming,
    conversations,
    activeConversationId,
    conversationTitle,
    activeAgentGraph,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadConversation,
    newConversation,
  } = useDevonnChat({
    userId,
    config: { model: selectedModel },
    agentMode: true,
  });

  // Last assistant message for TTS
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant' && !m.streaming)?.content;

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  if (!userId) {
    return (
      <div className="d3-ai-loader min-h-screen">
        <D3vonnPageBanner title="D3VONN.IO Chat" />
        <div className="d3-ai-loader__core" role="status" aria-live="polite"><div className="d3-ai-loader__ring" aria-hidden="true" /><p className="text-sm text-blue-100/70">Authenticating secure AI workspace</p></div>
      </div>
    );
  }

  return (
    <div className="d3-os-shell flex h-[100dvh] bg-background overflow-hidden" style={{ paddingTop: '64px' }}>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            aria-label="Conversation history" className="absolute inset-y-16 left-0 z-30 flex flex-col overflow-hidden border-r shadow-2xl md:static md:inset-auto md:z-auto md:flex-shrink-0 md:shadow-none"
            style={{
              background: 'linear-gradient(180deg, #070d1a 0%, #0a1628 100%)',
              borderColor: 'rgba(112, 128, 255, 0.1)',
            }}
          >
            {/* Sidebar header */}
            <div className="p-4 border-b" style={{ borderColor: 'rgba(112, 128, 255, 0.1)' }}>
              <button
                onClick={newConversation}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white transition-colors"
                style={{
                  background: 'rgba(112, 128, 255, 0.08)',
                  border: '1px solid rgba(112, 128, 255, 0.2)',
                }}
              >
                <Plus className="w-4 h-4 text-primary" />
                New conversation
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.length === 0 && (
                <p className="text-white/25 text-xs text-center py-6 px-3">
                  No conversations yet. Start chatting!
                </p>
              )}
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors group ${
                    conv.id === activeConversationId
                      ? 'bg-primary/10 border border-primary/20 text-white'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 flex-shrink-0 opacity-60" />
                    <span className="truncate">{conv.title}</span>
                  </div>
                  <p className="text-white/25 text-[10px] mt-0.5 ml-5">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>

            {/* User info */}
            <div
              className="p-3 border-t text-xs"
              style={{ borderColor: 'rgba(112, 128, 255, 0.1)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/15 border border-green-500/25 flex items-center justify-center">
                  <User className="w-3 h-3 text-primary" />
                </div>
                <span className="text-white/40 truncate">{userEmail}</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{
            background: 'rgba(7, 13, 26, 0.95)',
            borderColor: 'rgba(112, 128, 255, 0.1)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(s => !s)}
              aria-label={sidebarOpen ? "Close conversation history" : "Open conversation history"}
              aria-expanded={sidebarOpen}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <div>
              <h2 className="text-white text-sm font-semibold">{conversationTitle}</h2>
              <p className="text-white/30 text-xs font-mono">D3VONN.IO · {selectedModel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model selector */}
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="text-xs bg-transparent border border-white/10 rounded-lg px-2 py-1 text-white/60 hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:border-primary/50 focus-visible:shadow-focus-glow cursor-pointer"
            >
              <option value="gpt-4.1-mini" className="bg-card">GPT-4.1 Mini</option>
              <option value="gpt-4o" className="bg-card">GPT-4o</option>
              <option value="gpt-4.1-2025-04-14" className="bg-card">GPT-4.1 Turbo</option>
            </select>

            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:rounded-lg"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto" aria-live="polite" aria-label="Conversation messages">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-8 px-6 py-12">
              {/* Hero */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-white text-xl font-semibold mb-2">D3VONN.IO Workspace</h2>
                <p className="text-white/40 text-sm max-w-md">
                  Your AI operator for the Supreme Deployment Hub. Ask about deployments,
                  agents, workflows, infrastructure, or anything in the D3VONN.IO ecosystem.
                </p>
              </div>

              {/* Suggested prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {SUGGESTED_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="d3-command-surface text-left px-4 py-3 rounded-xl text-sm text-white/60 hover:text-white/90 transition-all group"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(112, 128, 255, 0.2)';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(112, 128, 255, 0.04)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                      msg.role === 'user'
                        ? 'bg-white/8 border border-white/12'
                        : 'bg-primary/10 border border-green-500/25'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <User className="w-4 h-4 text-white/50" />
                    ) : (
                      <Bot className="w-4 h-4 text-primary" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className="flex-1 max-w-[85%]">
                    {/* Agent console for this message */}
                    {(msg as any).agentGraph && (
                      <AgentConsole
                        graph={(msg as any).agentGraph}
                        collapsed={agentConsoleCollapsed}
                        onToggle={() => setAgentConsoleCollapsed(c => !c)}
                      />
                    )}
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary/10 border border-primary/15 text-white ml-auto'
                          : 'bg-white/4 border border-white/8 text-white/90'
                      } ${(msg as any).error ? 'border-red-500/30 bg-red-500/8' : ''}`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.streaming && (
                        <span className="inline-block w-2 h-4 bg-green-400 ml-0.5 animate-pulse rounded-sm" />
                      )}
                      {/* Provider badge */}
                      {msg.provider && !msg.streaming && (
                        <p className="text-white/20 text-[10px] mt-2 font-mono">
                          {msg.provider} · {msg.model}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Streaming indicator */}
              {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-green-500/25 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-1 px-4 py-3 rounded-2xl bg-white/4 border border-white/8">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-green-400/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="flex-shrink-0 border-t px-4 py-4"
          style={{
            background: 'rgba(7, 13, 26, 0.98)',
            borderColor: 'rgba(112, 128, 255, 0.1)',
          }}
        >
          <div className="max-w-3xl mx-auto">
            {/* Upload panel */}
            {showUploadPanel && (
              <div
                style={{
                  marginBottom: '8px',
                  background: 'rgba(7,13,26,0.95)',
                  border: '1px solid rgba(112,128,255,0.2)',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#7080FF' }}>INGEST DOCUMENTS INTO MEMORY</span>
                  <button onClick={() => setShowUploadPanel(false)} style={{ color: '#475569', fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
                <FileUploadHandler
                  userId={userId}
                  onIngestComplete={result => {
                    setLastIngestResult(result);
                    if (result.success) {
                      setTimeout(() => setLastIngestResult(null), 5000);
                    }
                  }}
                />
              </div>
            )}
            {/* Ingest success toast */}
            {lastIngestResult?.success && (
              <div style={{
                marginBottom: '8px',
                padding: '8px 12px',
                background: 'rgba(5,150,105,0.15)',
                border: '1px solid rgba(112,128,255,0.3)',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#7080FF',
              }}>
                [INDEXED] {lastIngestResult.filename} — {lastIngestResult.chunksIngested} chunks in memory. Ask me anything about it.
              </div>
            )}
            <div
              className="flex items-end gap-3 rounded-2xl px-4 py-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(112, 128, 255, 0.15)',
                boxShadow: '0 0 20px rgba(112, 128, 255, 0.04)',
              }}
            >
              {/* File upload toggle */}
              <button
                onClick={() => setShowUploadPanel(p => !p)}
                className="p-1 flex-shrink-0 mb-0.5 transition-colors"
                title="Upload file to memory"
                aria-label="Upload file to DKOS memory"
                aria-pressed={showUploadPanel}
                style={{ color: showUploadPanel ? '#7080FF' : 'rgba(255,255,255,0.25)' }}
              >
                <Upload className="w-4 h-4" />
              </button>

              {/* Text input */}
              <textarea
                ref={inputRef}
                value={interimTranscript ? `${input}${interimTranscript}` : input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message D3VONN.IO... (Shift+Enter for new line)"
                rows={1}
                className="flex-1 bg-transparent text-white text-sm placeholder-white/25 focus-visible:outline-none focus-visible:shadow-focus-glow resize-none leading-relaxed"
                style={{ maxHeight: '160px', opacity: interimTranscript ? 0.7 : 1 }}
              />

              {/* Voice controls */}
              <div className="flex-shrink-0 mb-0.5">
                <VoiceControls
                  lastAssistantMessage={lastAssistantMessage}
                  onTranscript={(text) => {
                    setInput(prev => prev + text + ' ');
                    setInterimTranscript('');
                  }}
                  onInterimTranscript={(text) => setInterimTranscript(text)}
                  isStreaming={isStreaming}
                />
              </div>

              {/* Send / Stop */}
              <div className="flex-shrink-0 mb-0.5">
                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    aria-label="Stop AI response"
                    className="p-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-colors"
                  >
                    <StopCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    aria-label="Send message"
                    disabled={!input.trim()}
                    className="p-2 rounded-xl transition-all disabled:opacity-30"
                    style={{
                      background: input.trim() ? 'rgba(112, 128, 255, 0.15)' : 'rgba(255,255,255,0.05)',
                      border: input.trim() ? '1px solid rgba(112, 128, 255, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Send className={`w-4 h-4 ${input.trim() ? 'text-primary' : 'text-white/30'}`} />
                  </button>
                )}
              </div>
            </div>

            <p className="text-center text-white/15 text-[10px] mt-2 font-mono">
              D3VONN.IO · Supreme Deployment Hub · {selectedModel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
