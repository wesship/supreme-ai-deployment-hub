import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MusicProductionStudio from '../MusicProductionStudio';

const auth = vi.hoisted(() => ({ callback: null as ((event: string, session: { user: { id: string } } | null) => void) | null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: (callback: typeof auth.callback) => { auth.callback = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; } } } }));
vi.mock('../StemStudio', () => ({ default: ({ onMixSession }: { onMixSession?: (session: unknown) => void }) => <button disabled={!onMixSession} onClick={() => onMixSession?.({ id: 'private-job', label: '30-second previews', stems: [{ id: 'vocals', name: 'Private vocals' }] })}>Send loaded previews</button> }));
vi.mock('@/music/MusicWebAudioMixer', () => ({ default: ({ session }: { session: { label: string; stems: { name: string }[] } | null }) => <div>{session ? `${session.label}: ${session.stems[0].name}` : 'Empty mixer'}</div> }));
beforeEach(() => { auth.callback = null; });
afterEach(() => cleanup());

describe('Integrated music production session', () => {
  it('bridges loaded previews directly into the mixer when explicitly enabled', () => {
    render(<MusicProductionStudio mixerEnabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Send loaded previews' }));
    expect(screen.getByText('30-second previews: Private vocals')).toBeInTheDocument();
  });
  it('clears bridged audio when the signed-in account changes', async () => {
    render(<MusicProductionStudio mixerEnabled />);
    await act(async () => auth.callback?.('SIGNED_IN', { user: { id: 'alice' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Send loaded previews' }));
    expect(screen.getByText(/Private vocals/)).toBeInTheDocument();
    await act(async () => auth.callback?.('SIGNED_IN', { user: { id: 'bob' } }));
    expect(screen.queryByText(/Private vocals/)).not.toBeInTheDocument();
    expect(screen.getByText('Empty mixer')).toBeInTheDocument();
  });
  it('does not offer the mixer bridge when the feature is disabled', () => {
    render(<MusicProductionStudio mixerEnabled={false} />);
    expect(screen.getByRole('button', { name: 'Send loaded previews' })).toBeDisabled();
    expect(screen.queryByText('Empty mixer')).not.toBeInTheDocument();
  });
});
