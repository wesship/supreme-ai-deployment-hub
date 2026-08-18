import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Circle,
  Download,
  Film,
  Info,
  Loader2,
  Play,
  Search,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import { getOpenMontageJob } from '@/features/ai-films/openMontageService';

const FILM_PAGE_URL = 'https://d3vonn.io/film';
const FILM_PAGE_TITLE = 'D3VONN Studios | AI Films & OpenMontage';
const FILM_PAGE_DESCRIPTION =
  'Watch D3VONN Originals and create governed AI films through the OpenMontage production workflow.';
const OPENMONTAGE_SLUG = 'openmontage-video-intelligence-studio';
const INTRO_STORAGE_KEY = 'd3vonn-ai-films-intro-seen-v1';

type StageState = 'pending' | 'running' | 'completed' | 'failed';
type Stage = { name: string; status: StageState; updatedAt?: string };
type Movie = {
  title: string;
  category: string;
  description: string;
  duration: string;
  badge?: string;
  progress?: number;
  accent: string;
  videoSrc: string;
  posterSrc: string;
};

const movies: Movie[] = [
  {
    title: 'Sovereign Signal',
    category: 'D3VONN Originals',
    description: 'A cinematic AI thriller about power, intelligence, and the signal that changes civilization.',
    duration: 'Feature Film',
    badge: 'Featured Original',
    accent: 'from-cyan-500/40 via-blue-700/20 to-black',
    videoSrc: '/films/sovereign-signal.mp4',
    posterSrc: '/films/sovereign-signal-keyframe.png',
  },
  {
    title: 'Building D3VONN.IO',
    category: 'Documentaries',
    description: 'Inside the architecture, agents, infrastructure, and vision behind the D3VONN ecosystem.',
    duration: '42 min',
    progress: 36,
    accent: 'from-blue-500/35 via-slate-800/30 to-black',
    videoSrc: '/films/building-d3vonn.mp4',
    posterSrc: '/films/building-d3vonn-keyframe.png',
  },
  {
    title: 'Inside HERMES',
    category: 'Engineering',
    description: 'A deep dive into the canonical orchestration engine coordinating the D3VONN agent system.',
    duration: '28 min',
    badge: 'Engineering Series',
    accent: 'from-indigo-500/35 via-blue-950/40 to-black',
    videoSrc: '/films/inside-hermes.mp4',
    posterSrc: '/films/inside-hermes-keyframe.png',
  },
  {
    title: 'GUARDIAN',
    category: 'Security',
    description: 'How governance, security controls, and approval gates protect autonomous AI workflows.',
    duration: '24 min',
    accent: 'from-sky-500/30 via-slate-950/40 to-black',
    videoSrc: '/films/guardian.mp4',
    posterSrc: '/films/guardian-keyframe.png',
  },
  {
    title: 'The AI Workforce',
    category: 'Enterprise',
    description: 'How multi-agent systems are transforming operations, customer service, and enterprise execution.',
    duration: '34 min',
    badge: 'New Release',
    accent: 'from-cyan-400/30 via-blue-900/35 to-black',
    videoSrc: '/films/ai-workforce.mp4',
    posterSrc: '/films/ai-workforce-keyframe.png',
  },
  {
    title: 'Agent Zero',
    category: 'D3VONN Originals',
    description: 'An autonomous intelligence wakes inside a system designed never to let it leave.',
    duration: 'Feature Film',
    accent: 'from-violet-500/35 via-indigo-950/30 to-black',
    videoSrc: '/films/agent-zero.mp4',
    posterSrc: '/films/agent-zero-keyframe.png',
  },
  {
    title: 'Knowledge Graph Universe',
    category: 'Research',
    description: 'Explore the connected intelligence layer linking films, agents, documents, APIs, and memory.',
    duration: '31 min',
    accent: 'from-teal-400/30 via-cyan-950/30 to-black',
    videoSrc: '/films/knowledge-graph-universe.mp4',
    posterSrc: '/films/knowledge-graph-universe-keyframe.png',
  },
  {
    title: 'AI Around the World',
    category: 'Global Innovation',
    description: 'A global documentary series on AI infrastructure, smart cities, and emerging innovation hubs.',
    duration: 'Series',
    accent: 'from-blue-400/30 via-slate-900/40 to-black',
    videoSrc: '/films/ai-around-the-world.mp4',
    posterSrc: '/films/ai-around-the-world-keyframe.png',
  },
];

const montageScenes = [
  { kicker: 'D3VONN.IO PRESENTS', title: 'INTELLIGENCE IN MOTION' },
  { kicker: 'AUTONOMOUS SYSTEMS', title: 'AGENTS. MEMORY. ORCHESTRATION.' },
  { kicker: 'D3VONN ORIGINALS', title: 'STORIES BUILT WITH INTELLIGENCE' },
  { kicker: 'OPENMONTAGE STUDIO', title: 'FROM IDEA TO FILM' },
];

const stageIcon = (status: StageState) => {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
};

const MovieCard = ({ movie, onPlay }: { movie: Movie; onPlay: (movie: Movie) => void }) => (
  <button
    type="button"
    onClick={() => onPlay(movie)}
    className="group min-w-[250px] max-w-[250px] overflow-hidden rounded-2xl border border-white/10 bg-black/40 text-left shadow-xl transition hover:-translate-y-1 hover:border-cyan-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    aria-label={`Open ${movie.title}`}
  >
    <div className={`relative aspect-video bg-gradient-to-br ${movie.accent}`}>
      <video
        src={movie.videoSrc}
        poster={movie.posterSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,10,0.05),rgba(2,5,10,0.5)),radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.16),transparent_30%),linear-gradient(120deg,transparent,rgba(34,211,238,0.1),transparent)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full border border-white/20 bg-black/50 p-3 opacity-0 backdrop-blur-md transition group-hover:opacity-100">
          <Play className="h-6 w-6 fill-white text-white" />
        </div>
      </div>
      {movie.badge && <Badge className="absolute left-3 top-3 border-cyan-300/30 bg-black/60 text-cyan-100">{movie.badge}</Badge>}
      <span className="absolute bottom-3 right-3 text-xs font-semibold text-white/80">{movie.duration}</span>
    </div>
    <div className="space-y-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">{movie.category}</p>
      <h3 className="text-lg font-semibold text-white">{movie.title}</h3>
      <p className="line-clamp-2 text-sm text-slate-400">{movie.description}</p>
      {typeof movie.progress === 'number' && (
        <div className="h-1 overflow-hidden rounded-full bg-white/10" aria-label={`${movie.progress}% watched`}>
          <div className="h-full bg-cyan-300" style={{ width: `${movie.progress}%` }} />
        </div>
      )}
    </div>
  </button>
);

const FilmPage = () => {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [screenplay, setScreenplay] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [jobId, setJobId] = useState('');
  const [renderJobId, setRenderJobId] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('idle');
  const [stages, setStages] = useState<Stage[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [introScene, setIntroScene] = useState(0);
  const [muted, setMuted] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  useEffect(() => {
    const alreadySeen = window.localStorage.getItem(INTRO_STORAGE_KEY) === 'true';
    if (!alreadySeen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setShowIntro(true);
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const sceneTimer = window.setInterval(() => {
      setIntroScene((current) => Math.min(current + 1, montageScenes.length - 1));
    }, 2100);
    const closeTimer = window.setTimeout(() => {
      window.localStorage.setItem(INTRO_STORAGE_KEY, 'true');
      setShowIntro(false);
    }, 8600);
    return () => {
      window.clearInterval(sceneTimer);
      window.clearTimeout(closeTimer);
    };
  }, [showIntro]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(movies.map((movie) => movie.category)))], []);
  const filteredMovies = useMemo(() => {
    const term = query.trim().toLowerCase();
    return movies.filter((movie) => {
      const categoryMatch = activeCategory === 'All' || movie.category === activeCategory;
      const searchMatch = !term || `${movie.title} ${movie.category} ${movie.description}`.toLowerCase().includes(term);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, query]);

  const skipIntro = () => {
    window.localStorage.setItem(INTRO_STORAGE_KEY, 'true');
    setShowIntro(false);
  };

  const replayIntro = () => {
    setIntroScene(0);
    setShowIntro(true);
  };

  useEffect(() => {
    if (!renderJobId || status === 'completed' || status === 'failed') return;
    let cancelled = false;
    let timer: number | undefined;

    const syncRender = async () => {
      try {
        const update = await getOpenMontageJob(renderJobId);
        if (cancelled) return;
        setProvider(update.provider);
        setStatus(update.status);
        setStages(update.stages);
        if (update.video_url) setVideoUrl(update.video_url);
        if (update.error) toast.error(update.error);
        const reviewTerminal = ['revise', 'block', 'failed'].includes(update.review_state || '');
        if (!['completed', 'failed'].includes(update.status) && !reviewTerminal) {
          timer = window.setTimeout(() => { void syncRender(); }, 10000);
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Unable to refresh render status.');
      }
    };

    void syncRender();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [renderJobId, status]);

  const handleFnError = async (err: any, fallback: string) => {
    let payload: any = null;
    try {
      if (err?.context && typeof err.context.json === 'function') payload = await err.context.json();
    } catch {
      // Use the connector error when the response body cannot be decoded.
    }
    const code = payload?.error;
    const message = payload?.message;
    if (payload?.jobId) setJobId(payload.jobId);
    if (code === 'PAYMENT_REQUIRED') toast.error('Out of AI credits', { description: message });
    else if (code === 'RATE_LIMITED') toast.error('Rate limited', { description: message });
    else if (code === 'SERVICE_NOT_CONFIGURED') toast.error('Film provider is not configured', { description: message });
    else toast.error(message || err?.message || fallback);
  };

  const findOpenMontageDeployment = async () => {
    const { data } = await (supabase as any)
      .from('deployed_agents')
      .select('id,status')
      .eq('template_id', 'agent-video-001')
      .order('deployed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id as string | undefined;
  };

  const generateFilm = async () => {
    if (!idea.trim()) {
      toast.error('Please enter your film idea');
      return;
    }

    setLoading(true);
    setVideoUrl('');
    setJobId('');
    setRenderJobId('');
    setProvider('');
    setStatus('script');
    setStages([
      { name: 'research', status: 'completed' },
      { name: 'script', status: 'running' },
      ...['storyboard', 'assets', 'narration', 'render', 'review', 'publish'].map((name) => ({
        name,
        status: 'pending' as StageState,
      })),
    ]);

    try {
      const { data: screenplayData, error: screenplayError } = await supabase.functions.invoke(
        'generate-screenplay',
        { body: { idea: idea.trim(), agentSlug: OPENMONTAGE_SLUG } },
      );

      if (screenplayError) {
        await handleFnError(screenplayError, 'Failed to generate screenplay');
        setStatus('failed');
        return;
      }

      if (!screenplayData?.screenplay) {
        toast.error('The screenplay service returned an empty response');
        setStatus('failed');
        return;
      }

      setScreenplay(screenplayData.screenplay);
      setStatus('storyboard');
      toast.success('Screenplay generated. OpenMontage is preparing the production job.');

      const deployedAgentId = await findOpenMontageDeployment();
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-film', {
        body: {
          idea: idea.trim(),
          screenplay: screenplayData.screenplay,
          agentSlug: OPENMONTAGE_SLUG,
          deployedAgentId,
        },
      });

      if (videoError) {
        await handleFnError(videoError, 'Failed to generate film');
        setStatus('failed');
        return;
      }

      if (videoData?.jobId) setJobId(videoData.jobId);
      if (videoData?.renderJobId) setRenderJobId(videoData.renderJobId);
      if (videoData?.provider) setProvider(videoData.provider);
      if (videoData?.status) setStatus(videoData.status);
      if (Array.isArray(videoData?.stages)) setStages(videoData.stages);

      if (videoData?.videoUrl) {
        setVideoUrl(videoData.videoUrl);
        toast.success('Film created successfully!');
      } else if (videoData?.renderJobId || videoData?.status === 'render') {
        toast.success('OpenMontage queued the real render job.', {
          description: videoData.message || 'The provider will complete the render, review, and publication workflow asynchronously.',
        });
      } else {
        toast.error('The film service returned no render job.');
      }
    } catch (error: any) {
      console.error('Film generation error:', error);
      setStatus('failed');
      toast.error(error?.message || 'Failed to generate film');
    } finally {
      setLoading(false);
    }
  };

  const downloadScreenplay = () => {
    const blob = new Blob([screenplay], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'openmontage-screenplay.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'D3VONN Studios and OpenMontage AI Film Studio',
    url: FILM_PAGE_URL,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    description: FILM_PAGE_DESCRIPTION,
    creator: { '@type': 'Organization', name: 'D3VONN.IO', url: 'https://d3vonn.io' },
  };

  return (
    <div className="d3-os-shell min-h-screen bg-[#02050a] text-white">
      <Helmet>
        <title>{FILM_PAGE_TITLE}</title>
        <meta name="description" content={FILM_PAGE_DESCRIPTION} />
        <link rel="canonical" href={FILM_PAGE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="D3VONN.IO" />
        <meta property="og:title" content={FILM_PAGE_TITLE} />
        <meta property="og:description" content={FILM_PAGE_DESCRIPTION} />
        <meta property="og:url" content={FILM_PAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={FILM_PAGE_TITLE} />
        <meta name="twitter:description" content={FILM_PAGE_DESCRIPTION} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <AnimatePresence>
        {showIntro && (
          <motion.div
            className="fixed inset-0 z-[100] overflow-hidden bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-label="D3VONN Studios cinematic intro"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,0.35),transparent_32%),radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.16),transparent_24%),linear-gradient(180deg,#00030a,#000)]" />
            <motion.div
              className="absolute inset-[-20%] bg-[conic-gradient(from_90deg_at_50%_50%,transparent,rgba(34,211,238,0.18),transparent,rgba(59,130,246,0.18),transparent)] blur-3xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative flex h-full items-center justify-center px-6 text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={introScene}
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.03 }}
                  transition={{ duration: 0.7 }}
                  className="max-w-5xl"
                >
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[0.5em] text-cyan-300 sm:text-sm">
                    {montageScenes[introScene].kicker}
                  </p>
                  <h1 className="bg-gradient-to-b from-white via-slate-100 to-slate-500 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl lg:text-8xl">
                    {montageScenes[introScene].title}
                  </h1>
                  <div className="mx-auto mt-8 h-px w-40 bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
              <button type="button" onClick={() => setMuted((value) => !value)} className="rounded-full border border-white/15 bg-black/50 p-3 text-white/80 backdrop-blur" aria-label={muted ? 'Unmute intro' : 'Mute intro'}>
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <Button onClick={skipIntro} variant="outline" className="border-white/20 bg-black/50 text-white hover:bg-white/10">
                <SkipForward className="mr-2 h-4 w-4" /> Skip Intro
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <D3vonnPageBanner title="D3VONN Studios" />

      <div className="border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm" className="text-slate-300 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <Film className="h-6 w-6 text-cyan-300" aria-hidden="true" />
              <div>
                <h1 className="text-xl font-bold">AI Films</h1>
                <p className="text-xs text-slate-400">Movies, originals, and OpenMontage creation</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={replayIntro} variant="outline" size="sm" className="border-white/15 bg-white/5 text-white">
              <Play className="mr-2 h-4 w-4" /> Replay Intro
            </Button>
            <Button onClick={() => document.getElementById('openmontage-studio')?.scrollIntoView({ behavior: 'smooth' })} size="sm" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              <Sparkles className="mr-2 h-4 w-4" /> Create a Film
            </Button>
          </div>
        </div>
      </div>

      <main>
        <section className="relative min-h-[72vh] overflow-hidden border-b border-white/10">
          <video
            src={movies[0].videoSrc}
            poster={movies[0].posterSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(37,99,235,0.38),transparent_25%),radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.16),transparent_25%),linear-gradient(90deg,#02050a_0%,rgba(2,5,10,0.9)_42%,rgba(2,5,10,0.35)_100%)]" />
          <div className="absolute right-[-8%] top-[8%] h-[520px] w-[520px] rounded-full border border-cyan-300/10 bg-blue-500/10 blur-2xl" />
          <div className="container relative mx-auto flex min-h-[72vh] items-center px-4 py-20 sm:px-6">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
              <Badge className="mb-5 border-cyan-300/30 bg-cyan-300/10 text-cyan-200">D3VONN ORIGINAL FEATURE</Badge>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">Now Featured</p>
              <h2 className="text-5xl font-black tracking-tight sm:text-7xl lg:text-8xl">SOVEREIGN SIGNAL</h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
                A cinematic AI thriller about intelligence, ownership, and the signal that forces humanity to decide who controls the future.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button onClick={() => setSelectedMovie(movies[0])} size="lg" className="bg-white text-black hover:bg-slate-200">
                  <Play className="mr-2 h-5 w-5 fill-black" /> Play
                </Button>
                <Button onClick={() => setSelectedMovie(movies[0])} size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                  <Info className="mr-2 h-5 w-5" /> More Info
                </Button>
                <Button onClick={() => toast.success('Sovereign Signal added to your library')} size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                  <Bookmark className="mr-2 h-5 w-5" /> My Library
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="container mx-auto space-y-10 px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">D3VONN Studios</p>
              <h2 className="mt-2 text-3xl font-bold">Explore Movies and Originals</h2>
            </div>
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search films, topics, or series" className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500" />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Film categories">
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                size="sm"
                variant={activeCategory === category ? 'default' : 'outline'}
                onClick={() => setActiveCategory(category)}
                className={activeCategory === category ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200' : 'shrink-0 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}
              >
                {category}
              </Button>
            ))}
          </div>

          {filteredMovies.length > 0 ? (
            <div className="flex gap-5 overflow-x-auto pb-6">
              {filteredMovies.map((movie) => <MovieCard key={movie.title} movie={movie} onPlay={setSelectedMovie} />)}
            </div>
          ) : (
            <Card className="border-white/10 bg-white/5 p-10 text-center text-slate-400">No films matched your search.</Card>
          )}

          <div className="grid gap-5 md:grid-cols-3">
            {[
              ['AI Companion', 'Ask questions, summarize scenes, and connect films to D3VONN documentation.'],
              ['Knowledge Graph', 'Discover related agents, workflows, APIs, research, and tutorials from every film.'],
              ['Enterprise Learning', 'Turn films into structured learning paths with chapters, progress, and certification.'],
            ].map(([title, description]) => (
              <Card key={title} className="border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6 text-white">
                <Sparkles className="mb-5 h-6 w-6 text-cyan-300" />
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="openmontage-studio" className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(2,5,10,0.8),#050b14)]">
          <div className="container mx-auto px-4 py-16 sm:px-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mx-auto max-w-4xl">
              <div className="mb-8 text-center">
                <Badge variant="outline" className="mb-4 border-cyan-300/30 text-cyan-200">Hermes governed</Badge>
                <h2 className="mb-4 text-4xl font-bold">OpenMontage AI Film Studio</h2>
                <p className="text-slate-400">Route your idea through research, script, storyboard, assets, narration, render, review, and publish.</p>
              </div>

              <Card className="d3-chrome-panel mb-6 border-0 bg-white/[0.06] p-4 sm:p-6">
                <label htmlFor="film-idea" className="sr-only">Film idea</label>
                <Textarea
                  id="film-idea"
                  placeholder="Describe your film idea, tone, characters, setting, audience, and desired runtime..."
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  className="mb-4 min-h-[170px] border-white/10 bg-black/30 text-white placeholder:text-slate-500"
                  maxLength={5000}
                />
                <Button onClick={generateFilm} disabled={loading} className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {loading ? `OpenMontage: ${status === 'script' ? 'Writing screenplay' : 'Building production'}` : 'Generate Film & Screenplay'}
                </Button>
              </Card>

              {stages.length > 0 && (
                <Card className="mb-6 border-white/10 bg-white/[0.04] p-6 text-white">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-bold">Production Workflow</h3>
                    <div className="flex gap-2"><Badge variant="secondary">{status}</Badge>{provider && <Badge variant="outline">{provider}</Badge>}</div>
                  </div>
                  <div aria-live="polite" aria-label={`Production status: ${status}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {stages.map((stage) => (
                      <div key={stage.name} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                        {stageIcon(stage.status)}<span className="text-sm font-medium capitalize">{stage.name}</span>
                      </div>
                    ))}
                  </div>
                  {jobId && <p className="mt-4 text-xs text-slate-500">Job: {jobId}</p>}
                </Card>
              )}

              {screenplay && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                  <Card className="d3-chrome-panel border-0 bg-white/[0.06] p-4 text-white sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h3 className="text-xl font-bold">Screenplay</h3>
                      <Button onClick={downloadScreenplay} variant="outline" size="sm" className="border-white/15 text-white"><Download className="mr-2 h-4 w-4" /> Download TXT</Button>
                    </div>
                    <pre className="max-h-[520px] whitespace-pre-wrap overflow-auto text-sm leading-relaxed text-slate-300">{screenplay}</pre>
                  </Card>
                </motion.div>
              )}

              {videoUrl && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="d3-chrome-panel border-0 bg-white/[0.06] p-4 text-white sm:p-6">
                    <h3 className="mb-4 text-xl font-bold">Your Film</h3>
                    <video src={videoUrl} controls playsInline preload="metadata" className="w-full rounded-lg">Your browser does not support HTML video playback.</video>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedMovie && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedMovie(null)}>
            <motion.div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/15 bg-[#07101d] shadow-2xl" initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${selectedMovie.title} details`}>
              <button type="button" onClick={() => setSelectedMovie(null)} className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/50 p-2 text-white" aria-label="Close movie details"><X className="h-5 w-5" /></button>
              <div className={`relative aspect-video bg-gradient-to-br ${selectedMovie.accent}`}>
                <video
                  src={selectedMovie.videoSrc}
                  poster={selectedMovie.posterSrc}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                >
                  Your browser does not support HTML video playback.
                </video>
              </div>
              <div className="space-y-4 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2"><Badge className="bg-cyan-300 text-slate-950">{selectedMovie.category}</Badge><Badge variant="outline" className="border-white/15 text-slate-300">{selectedMovie.duration}</Badge></div>
                <h2 className="text-3xl font-bold">{selectedMovie.title}</h2>
                <p className="text-slate-300">{selectedMovie.description}</p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => toast.success(`${selectedMovie.title} playback is ready for the final media asset.`)} className="bg-white text-black hover:bg-slate-200"><Play className="mr-2 h-4 w-4 fill-black" /> Play</Button>
                  <Button onClick={() => toast.success(`${selectedMovie.title} added to your library`)} variant="outline" className="border-white/15 text-white"><Bookmark className="mr-2 h-4 w-4" /> Add to Library</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilmPage;
