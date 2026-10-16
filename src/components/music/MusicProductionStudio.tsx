import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import MusicWebAudioMixer from '@/music/MusicWebAudioMixer';
import type { MixerSession } from '@/music/musicMixer';
import StemStudio from './StemStudio';

export default function MusicProductionStudio({ mixerEnabled = import.meta.env.VITE_MUSIC_WEB_AUDIO_MIXER === 'true' }: { mixerEnabled?: boolean }) {
  const [account, setAccount] = useState<string | null>(null);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setAccount(session?.user.id ?? null));
    return () => subscription.unsubscribe();
  }, []);
  return <ProductionSession key={account ?? 'signed-out'} mixerEnabled={mixerEnabled} />;
}

function ProductionSession({ mixerEnabled }: { mixerEnabled: boolean }) {
  const [session, setSession] = useState<MixerSession | null>(null);
  return <div className="space-y-8">
    <StemStudio onMixSession={mixerEnabled ? setSession : undefined} />
    {mixerEnabled && <MusicWebAudioMixer session={session} />}
  </div>;
}
