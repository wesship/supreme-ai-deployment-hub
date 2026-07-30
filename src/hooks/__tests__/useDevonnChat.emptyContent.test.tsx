/**
 * Regression test for issue #638
 *
 * Production floating chat returned HTTP 422 because a failed first response
 * persisted an empty assistant message, which was then replayed on the next
 * request as `messages[].content = ''`.
 *
 * This suite proves:
 *  - a failed stream persists the displayed error text (never empty content)
 *  - the second request contains no empty/whitespace-only message content
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ChatMessage, StreamChunk } from '@/services/ai/orchestrator';

const streamCalls: ChatMessage[][] = [];
const savedConversations: any[] = [];

vi.mock('@/services/ai/orchestrator', () => ({
  DEVONN_SYSTEM_PROMPT: 'system',
  streamChat: vi.fn(async function* (messages: ChatMessage[]): AsyncGenerator<StreamChunk> {
    streamCalls.push(messages.map(m => ({ ...m })));
    if (streamCalls.length === 1) {
      // First turn fails before any delta arrives
      yield { delta: '', done: true, error: 'upstream unavailable' };
      return;
    }
    yield { delta: 'Recovered response', done: false, provider: 'openai', model: 'gpt-4.1-mini' };
    yield { delta: '', done: true, provider: 'openai', model: 'gpt-4.1-mini' };
  }),
}));

vi.mock('@/services/ai/agentRouter', () => ({
  shouldUseAgentMode: () => false,
  routeToAgents: vi.fn(),
}));

vi.mock('@/services/ai/conversationStore', () => ({
  getConversations: vi.fn(async () => []),
  saveConversation: vi.fn(async (conv: any) => {
    savedConversations.push(JSON.parse(JSON.stringify(conv)));
  }),
  generateTitle: (t: string) => t.slice(0, 20),
}));

import { useDevonnChat } from '../useDevonnChat';

describe('useDevonnChat — empty assistant content (issue #638)', () => {
  beforeEach(() => {
    streamCalls.length = 0;
    savedConversations.length = 0;
  });

  it('persists error text on a failed stream and never sends empty content on the next prompt', async () => {
    const { result } = renderHook(() => useDevonnChat({ agentMode: false }));

    await act(async () => {
      await result.current.sendMessage('first prompt');
    });

    // Failed turn: displayed message carries the error text, not ''
    const assistant = result.current.messages.find(m => m.role === 'assistant');
    expect(assistant?.content).toContain('upstream unavailable');
    expect(assistant?.content.trim()).not.toBe('');

    // Persisted conversation contains no empty message content
    const persisted = savedConversations.at(-1);
    expect(persisted.messages.length).toBeGreaterThan(0);
    for (const m of persisted.messages) {
      expect(m.content.trim()).not.toBe('');
    }

    // Second prompt
    await act(async () => {
      await result.current.sendMessage('second prompt');
    });

    await waitFor(() => expect(streamCalls.length).toBe(2));

    const secondRequest = streamCalls[1];
    expect(secondRequest.length).toBeGreaterThan(0);
    for (const m of secondRequest) {
      expect(typeof m.content).toBe('string');
      expect(m.content.trim()).not.toBe('');
    }
    expect(secondRequest.some(m => m.content === '')).toBe(false);
    expect(secondRequest.at(-1)?.content).toBe('second prompt');
  });

  it('does not keep an empty assistant bubble when a stream yields no deltas', async () => {
    const { result } = renderHook(() => useDevonnChat({ agentMode: false }));

    await act(async () => {
      await result.current.sendMessage('first prompt');
    });

    expect(result.current.messages.every(m => m.content.trim().length > 0)).toBe(true);
  });
});
