import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FloatingChatWidget } from './FloatingChatWidget';

const { chat, auth, unsubscribe } = vi.hoisted(() => ({
  chat: vi.fn(() => ({ messages: [], isStreaming: false, sendMessage: vi.fn(), stopStreaming: vi.fn() })),
  auth: vi.fn(async () => ({ data: { session: null } })),
  unsubscribe: vi.fn(),
}));
vi.mock('@/hooks/useDevonnChat', () => ({ useDevonnChat: chat }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  getSession: auth,
  onAuthStateChange: () => ({ data: { listener: null, subscription: { unsubscribe } } }),
} } }));
vi.mock('./VoiceControls', () => ({ VoiceControls: () => <span>Voice controls</span> }));
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Floating chat activation', () => {
  it('does not initialize chat or auth while closed; first click opens and focuses the session', async () => {
    render(<MemoryRouter><FloatingChatWidget /></MemoryRouter>);
    expect(chat).not.toHaveBeenCalled();
    expect(auth).not.toHaveBeenCalled();
    expect(screen.queryByText('Voice controls')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Devonn AI Chat' }));
    const input = await screen.findByPlaceholderText('Ask Devonn...');
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(auth).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Voice controls')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close Devonn AI Chat' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('Ask Devonn...')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Open Devonn AI Chat' }));
    const reopened = await screen.findByPlaceholderText('Ask Devonn...');
    expect((reopened as HTMLInputElement).value).toBe('Keep this draft');
    await waitFor(() => expect(document.activeElement).toBe(reopened));
    expect(auth).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
