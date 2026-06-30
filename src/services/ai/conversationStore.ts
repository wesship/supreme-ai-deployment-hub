/**
 * D3VONN Conversation Store
 * Persists conversations to Supabase (authenticated) or localStorage (anonymous/demo)
 */

import { supabase } from '@/integrations/supabase/client';

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  provider?: string;
  model?: string;
  tokens?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

const LOCAL_KEY = 'd3vonn_conversations';
const MAX_LOCAL_CONVERSATIONS = 10;

// ─── Local Storage (anonymous / demo) ─────────────────────────────────────────

function loadLocal(): Conversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(conversations: Conversation[]): void {
  try {
    // Keep only the most recent N conversations
    const trimmed = conversations.slice(-MAX_LOCAL_CONVERSATIONS);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed));
  } catch { /* storage full — ignore */ }
}

export function getLocalConversations(): Conversation[] {
  return loadLocal().reverse(); // newest first
}

export function saveLocalConversation(conversation: Conversation): void {
  const all = loadLocal();
  const idx = all.findIndex(c => c.id === conversation.id);
  if (idx >= 0) {
    all[idx] = conversation;
  } else {
    all.push(conversation);
  }
  saveLocal(all);
}

export function deleteLocalConversation(id: string): void {
  const all = loadLocal().filter(c => c.id !== id);
  saveLocal(all);
}

// ─── Supabase (authenticated users) ───────────────────────────────────────────

export async function getSupabaseConversations(userId: string): Promise<Conversation[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const rows = (data || []) as any[];
    return rows.map(row => ({
      id: row.id,
      title: row.title ?? 'Untitled',
      messages: ((row.metadata as { messages?: StoredMessage[] } | null)?.messages ?? []) as StoredMessage[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id,
    }));
  } catch {
    // Fall back to local if Supabase table doesn't exist yet
    return getLocalConversations();
  }
}

export async function saveSupabaseConversation(
  conversation: Conversation,
  userId: string
): Promise<void> {
  try {
    await (supabase as any).from('conversations').upsert({
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
      user_id: userId,
      created_at: conversation.createdAt,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Fallback: save locally
    saveLocalConversation(conversation);
  }
}

// ─── Unified API ───────────────────────────────────────────────────────────────

export async function getConversations(userId?: string): Promise<Conversation[]> {
  if (userId) return getSupabaseConversations(userId);
  return getLocalConversations();
}

export async function saveConversation(
  conversation: Conversation,
  userId?: string
): Promise<void> {
  if (userId) {
    await saveSupabaseConversation(conversation, userId);
  } else {
    saveLocalConversation(conversation);
  }
}

export function generateTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/[^\w\s]/g, '').trim();
  const words = clean.split(/\s+/).slice(0, 6);
  return words.join(' ') || 'New conversation';
}
