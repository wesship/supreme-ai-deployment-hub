import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster, toast } from 'sonner';
import ConversationalVoiceControls from './ConversationalVoiceControls';

const sdk = vi.hoisted(() => ({
  handlers: new Map<string, (event?: unknown) => void>(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('@vapi-ai/web', () => ({
  default: class {
    on(name: string, handler: (event?: unknown) => void) { sdk.handlers.set(name, handler); }
    removeAllListeners() { sdk.handlers.clear(); }
    start = sdk.start;
    stop = sdk.stop;
  },
}));
vi.mock('@/config/voice', () => ({
  getVapiPublicKey: () => 'public-test-key',
  getVapiAssistantId: () => 'published-test-assistant',
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

beforeEach(() => {
  sdk.handlers.clear();
  sdk.start.mockReset().mockResolvedValue({ id: 'test-call' });
  sdk.stop.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: vi.fn() },
  });
});
afterEach(() => { toast.dismiss(); cleanup(); });

const setup = async () => {
  render(<><ConversationalVoiceControls /><Toaster /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Start D3VONN voice conversation' }));
  await waitFor(() => expect(sdk.start).toHaveBeenCalledWith('published-test-assistant'));
};

describe('voice provider failure recovery', () => {
  it.each([
    [{ statusCode: 403, message: 'Subscription limit reached', error: 'Forbidden', subscriptionLimits: { calls: 0 } }, 'Subscription limit reached'],
    [{ message: { message: 'Subscription limit reached' } }, 'Subscription limit reached'],
    [new Error('Microphone denied'), 'Microphone denied'],
    [{ message: ['Voice unavailable', 'Try again later'] }, 'Voice unavailable; Try again later'],
    [{ subscriptionLimits: { calls: 0 }, secret: 'DO_NOT_RENDER' }, 'Unknown voice error'],
  ])('renders a failed-call error as text and keeps the control usable', async (error, message) => {
    await setup();
    await act(async () => sdk.handlers.get('call-start-failed')?.({ error }));
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start D3VONN voice conversation' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'End D3VONN voice conversation' })).toBeNull();
    expect(document.body.textContent).not.toContain('DO_NOT_RENDER');
  });

  it('does not report a null call as connected and can retry', async () => {
    sdk.start.mockResolvedValueOnce(null);
    await setup();
    expect(await screen.findByText(/The voice provider did not create a call/)).toBeVisible();
    const start = screen.getByRole('button', { name: 'Start D3VONN voice conversation' });
    expect(start).toBeEnabled();
    expect(screen.queryByText('D3VONN voice session started')).toBeNull();
    fireEvent.click(start);
    await waitFor(() => expect(sdk.start).toHaveBeenCalledTimes(2));
    await act(async () => sdk.handlers.get('call-start')?.());
    const end = screen.getByRole('button', { name: 'End D3VONN voice conversation' });
    fireEvent.click(end);
    await waitFor(() => expect(start).toBeEnabled());
    expect(sdk.stop).toHaveBeenCalled();
  });

  it('requires call-start before showing connected, and clears it on SDK error', async () => {
    await setup();
    expect(screen.queryByRole('button', { name: 'End D3VONN voice conversation' })).toBeNull();
    await act(async () => sdk.handlers.get('call-start')?.());
    expect(screen.getByRole('button', { name: 'End D3VONN voice conversation' })).toBeEnabled();
    await act(async () => sdk.handlers.get('error')?.({ error: { message: 'Connection lost' } }));
    expect(await screen.findByText('Connection lost')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start D3VONN voice conversation' })).toBeEnabled();
  });
});
