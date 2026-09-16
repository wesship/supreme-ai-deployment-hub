import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Headphones, Pause, Play, Radio, RefreshCw, Users } from 'lucide-react';
import { dispatchTool } from '@/services/ai/toolRouter';
import {
  fetchHnfNowPlaying,
  getHnfRadioConfig,
  type HnfRadioNowPlaying,
} from '@/services/hnfRadio';

const HNF_BACKUP_STREAM_URL = 'https://listen.181fm.com/181-beat_128k.mp3';

const Music = () => {
  const config = useMemo(() => getHnfRadioConfig(), []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [usingBackup, setUsingBackup] = useState(!config.streamReady);
  const [nowPlaying, setNowPlaying] = useState<HnfRadioNowPlaying | null>(null);
  const [metadataError, setMetadataError] = useState(false);
  const [hermesState, setHermesState] = useState<'idle' | 'starting' | 'queued' | 'error'>('idle');
  const [hermesMessage, setHermesMessage] = useState('Ready to create a governed Hermes production radio-ops task.');

  const activeStream = usingBackup ? HNF_BACKUP_STREAM_URL : config.streamUrl;

  useEffect(() => {
    if (!config.metadataReady || usingBackup) {
      setNowPlaying(null);
      return;
    }

    let alive = true;
    const controller = new AbortController();

    const refresh = async () => {
      try {
        const data = await fetchHnfNowPlaying(controller.signal);
        if (!alive) return;
        setNowPlaying(data);
        setMetadataError(false);
      } catch {
        if (!alive) return;
        setMetadataError(true);
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 20_000);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [config.metadataReady, usingBackup]);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio(activeStream);
      audio.preload = 'none';
      audio.crossOrigin = 'anonymous';
      audio.addEventListener('playing', () => setPlaying(true));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('error', () => {
        if (!usingBackup) {
          setUsingBackup(true);
          setNowPlaying(null);
          setPlaying(false);
        }
      });
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  useEffect(() => {
    if (!audioRef.current) return;
    const shouldResume = !audioRef.current.paused;
    audioRef.current.pause();
    audioRef.current.src = activeStream;
    audioRef.current.load();
    if (shouldResume) {
      void audioRef.current.play().catch(() => setPlaying(false));
    }
  }, [activeStream]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const toggleRadio = async () => {
    const audio = ensureAudio();
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  const startHermesRadioOps = async () => {
    setHermesState('starting');
    setHermesMessage('Creating Hermes production goal and governed monitor task…');

    const response = await dispatchTool({
      id: `music-hub-radio-${Date.now()}`,
      name: 'spawn_agent',
      arguments: {
        agent_type: 'monitor',
        priority: 'high',
        task:
          'Operate HNF RADIO for D3VONN.IO Music Hub. Monitor the configured AzuraCast station health and now-playing metadata, verify the public stream before treating it as live, keep backup status explicit, and surface failures for operator review. Do not publish, replace stream endpoints, or perform destructive changes without approval.',
      },
    });

    const result = response.result as { status?: string; goal_id?: string; message?: string; fallback?: unknown } | null;
    if (response.error || !result || result.status !== 'success' || !result.goal_id) {
      setHermesState('error');
      setHermesMessage('Hermes production task was not confirmed. Sign in with operator access and verify api.d3vonn.io / Hermes production health.');
      return;
    }

    setHermesState('queued');
    setHermesMessage(`Hermes production radio-ops task queued. Goal ${result.goal_id}.`);
  };

  const stationStatus = config.streamReady && !usingBackup ? 'HNF station feed' : 'Backup feed · HNF server pending';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container mx-auto px-6 py-16 space-y-10">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-primary">D3VONN.IO</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Music Hub</h1>
          <p className="text-muted-foreground text-lg">
            AI music production, artist publishing, HNF RADIO, and Hermes-governed music operations in one surface.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]" aria-labelledby="hnf-radio-heading">
          <article className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Radio className="h-5 w-5" />
                  <span className="text-xs font-semibold tracking-[0.16em] uppercase">HNF RADIO</span>
                </div>
                <h2 id="hnf-radio-heading" className="text-2xl font-semibold">Official HNF station</h2>
                <p className="text-sm text-muted-foreground mt-2">{stationStatus}</p>
              </div>
              <button
                type="button"
                onClick={toggleRadio}
                className="h-12 w-12 rounded-full bg-primary text-primary-foreground grid place-items-center hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={playing ? 'Pause HNF RADIO' : 'Play HNF RADIO'}
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-5 min-h-32 flex items-center gap-4">
              {nowPlaying?.track?.artworkUrl ? (
                <img
                  src={nowPlaying.track.artworkUrl}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover border border-border"
                />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-background border border-border grid place-items-center">
                  <Headphones className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {usingBackup ? 'Backup programming' : 'Now playing'}
                </p>
                <p className="text-xl font-semibold truncate mt-1">
                  {usingBackup ? 'HNF RADIO backup feed' : nowPlaying?.track?.title || 'Waiting for station metadata'}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {usingBackup ? 'Primary AzuraCast station not verified yet' : nowPlaying?.track?.artist || 'HNF RADIO'}
                </p>
                {!usingBackup && nowPlaying && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> {nowPlaying.listeners} listening
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-3 py-1">AzuraCast-ready</span>
              <span className="rounded-full border border-border px-3 py-1">HTTPS-only production endpoints</span>
              <span className="rounded-full border border-border px-3 py-1">20s metadata refresh</span>
              {metadataError && <span className="rounded-full border border-destructive px-3 py-1 text-destructive">Metadata unavailable</span>}
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-2 text-primary">
              <Bot className="h-5 w-5" />
              <span className="text-xs font-semibold tracking-[0.16em] uppercase">Hermes Production</span>
            </div>
            <h2 className="text-2xl font-semibold">Radio Operations Agent</h2>
            <p className="text-sm text-muted-foreground">
              Uses the existing Hermes production goal/task engine to monitor HNF station health and metadata. It does not create a second scheduler or bypass operator controls.
            </p>
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Production policy</p>
              <p className="text-muted-foreground mt-1">Verify stream → monitor health → report anomalies → require approval for endpoint or publishing changes.</p>
            </div>
            <button
              type="button"
              onClick={startHermesRadioOps}
              disabled={hermesState === 'starting'}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {hermesState === 'starting' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {hermesState === 'queued' ? 'Hermes Radio Ops Queued' : 'Start Hermes Radio Monitor'}
            </button>
            <p className={`text-xs ${hermesState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{hermesMessage}</p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ['Generate', 'ACE-Step / HeartMuLa provider control plane remains governed by Music Hub qualification gates.'],
            ['Publish', 'Artist library and publishing surfaces can connect after production provider and storage gates pass.'],
            ['Broadcast', 'HNF RADIO uses the verified AzuraCast endpoint when live and an explicitly labelled backup before that.'],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-xl border border-border p-5 bg-card">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{copy}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
};

export default Music;
