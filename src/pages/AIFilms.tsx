import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  Info,
  Play,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import PublicPageShell from '@/components/shell/PublicPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FilmPage from './Film';

const breadcrumbs = [{ label: 'AI Films' }, { label: 'D3VONN Studios' }];
const INTRO_STORAGE_KEY = 'd3vonn-ai-films-intro-seen';

const movies = [
  {
    title: 'Sovereign Signal',
    category: 'D3VONN Originals',
    description: 'A cinematic AI thriller about intelligence, sovereignty, and the signal that changes civilization.',
    duration: 'Feature Film',
  },
  {
    title: 'Building D3VONN.IO',
    category: 'Documentary',
    description: 'Inside the architecture, agents, infrastructure, and vision behind one platform of infinite intelligence.',
    duration: 'Docuseries',
  },
  {
    title: 'Inside HERMES',
    category: 'Engineering',
    description: 'A deep dive into the canonical orchestration engine powering governed multi-agent execution.',
    duration: '28 min',
  },
  {
    title: 'GUARDIAN',
    category: 'Security',
    description: 'Governance, policy enforcement, human approval, and trust across autonomous AI systems.',
    duration: '22 min',
  },
  {
    title: 'AI Workforce',
    category: 'Enterprise',
    description: 'How autonomous agents reshape operations, customer service, research, and business execution.',
    duration: '34 min',
  },
  {
    title: 'Genesis Protocol',
    category: 'D3VONN Originals',
    description: 'The first intelligence awakens inside a distributed machine civilization.',
    duration: 'Coming Soon',
  },
];

const categories = ['All', ...Array.from(new Set(movies.map((movie) => movie.category)))];

const AIFilms = () => {
  const [showIntro, setShowIntro] = useState(false);
  const [muted, setMuted] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const hasSeenIntro = window.localStorage.getItem(INTRO_STORAGE_KEY) === 'true';
    setShowIntro(!hasSeenIntro && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(INTRO_STORAGE_KEY, 'true');
      setShowIntro(false);
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [showIntro]);

  const visibleMovies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return movies.filter((movie) => {
      const matchesCategory = activeCategory === 'All' || movie.category === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        movie.title.toLowerCase().includes(normalizedQuery) ||
        movie.description.toLowerCase().includes(normalizedQuery) ||
        movie.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const closeIntro = () => {
    window.localStorage.setItem(INTRO_STORAGE_KEY, 'true');
    setShowIntro(false);
  };

  const scrollToStudio = () => {
    document.getElementById('openmontage-studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <AnimatePresence>
        {showIntro && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-films-intro-title"
            aria-describedby="ai-films-intro-description"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,105,255,0.35),transparent_42%),linear-gradient(135deg,#02040a,#07152f_55%,#000)]"
            />
            <motion.div
              aria-hidden="true"
              className="absolute h-[34rem] w-[34rem] rounded-full border border-cyan-300/20"
              animate={{ rotate: 360, scale: [0.9, 1.08, 0.9] }}
              transition={{ rotate: { duration: 18, repeat: Infinity, ease: 'linear' }, scale: { duration: 5, repeat: Infinity } }}
            />
            <motion.div
              className="relative z-10 max-w-4xl px-6 text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2 }}
            >
              <motion.p
                className="mb-4 text-sm font-semibold uppercase tracking-[0.45em] text-cyan-200"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                D3VONN.IO Presents
              </motion.p>
              <motion.h1
                id="ai-films-intro-title"
                className="text-5xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl"
                initial={{ opacity: 0, filter: 'blur(18px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                transition={{ delay: 0.8, duration: 1.2 }}
              >
                AI FILMS
              </motion.h1>
              <motion.p
                id="ai-films-intro-description"
                className="mx-auto mt-6 max-w-2xl text-base text-blue-100 sm:text-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
              >
                Stories engineered by intelligence. Built with OpenMontage. Governed by HERMES.
              </motion.p>
              <motion.div
                className="mt-10 flex flex-wrap justify-center gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.4 }}
              >
                <Button type="button" onClick={closeIntro} size="lg" className="min-w-40">
                  <Play aria-hidden="true" className="mr-2 h-5 w-5" /> Enter Studios
                </Button>
                <Button
                  type="button"
                  onClick={() => setMuted((value) => !value)}
                  variant="outline"
                  size="icon"
                  aria-label={muted ? 'Unmute intro' : 'Mute intro'}
                  aria-pressed={!muted}
                >
                  {muted ? <VolumeX aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
                </Button>
              </motion.div>
            </motion.div>
            <Button type="button" onClick={closeIntro} variant="ghost" className="absolute right-4 top-4 text-white" aria-label="Skip intro">
              <X aria-hidden="true" className="mr-2 h-4 w-4" /> Skip Intro
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <section aria-label="D3VONN AI Films" className="overflow-hidden bg-background">
        <div className="relative min-h-[72vh] border-b border-border/60">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_78%_30%,rgba(20,105,255,0.35),transparent_30%),radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.12),transparent_24%),linear-gradient(120deg,#030711_10%,#07162f_58%,#020409)]" />
          <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="container relative z-10 mx-auto flex min-h-[72vh] items-end px-4 pb-16 pt-28 sm:px-6 lg:pb-24">
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
              <Badge className="mb-5" variant="secondary">D3VONN Original · Featured</Badge>
              <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl">Sovereign Signal</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">
                Enter a cinematic universe where intelligence, sovereignty, and human destiny collide. Create the next production directly inside OpenMontage.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" size="lg" onClick={scrollToStudio}>
                  <Sparkles aria-hidden="true" className="mr-2 h-5 w-5" /> Create a Film
                </Button>
                <Button type="button" size="lg" variant="outline" onClick={() => setShowIntro(true)}>
                  <Play aria-hidden="true" className="mr-2 h-5 w-5" /> Replay Intro
                </Button>
                <Button type="button" size="lg" variant="ghost" className="text-white">
                  <Info aria-hidden="true" className="mr-2 h-5 w-5" /> More Info
                </Button>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 sm:px-6 lg:py-16">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">D3VONN Studios</p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Movies and Originals</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">Discover flagship films, documentaries, engineering stories, and upcoming originals.</p>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <label htmlFor="movie-search" className="sr-only">Search movies, topics, or categories</label>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="movie-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search movies, topics, or categories"
                className="pl-10"
              />
            </div>
          </div>

          <div className="mb-8 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Film categories">
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                variant={activeCategory === category ? 'default' : 'outline'}
                size="sm"
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
            {visibleMovies.map((movie, index) => (
              <motion.article
                key={movie.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.06 }}
                className="group overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-2xl shadow-black/10 backdrop-blur"
              >
                <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_70%_25%,rgba(34,211,238,.45),transparent_25%),linear-gradient(135deg,#06142b,#02040a_70%)]">
                  <div aria-hidden="true" className="absolute inset-0 transition duration-500 group-hover:scale-110 group-hover:bg-primary/10" />
                  <Film aria-hidden="true" className="absolute left-6 top-6 h-9 w-9 text-cyan-200" />
                  <Button type="button" size="icon" className="absolute bottom-5 right-5 rounded-full" aria-label={`Play ${movie.title}`}>
                    <Play aria-hidden="true" className="h-5 w-5" />
                  </Button>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline">{movie.category}</Badge>
                    <span className="text-xs text-muted-foreground">{movie.duration}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{movie.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{movie.description}</p>
                </div>
              </motion.article>
            ))}
          </div>

          {visibleMovies.length === 0 && (
            <div role="status" className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">No films match this search.</div>
          )}
        </div>

        <div id="openmontage-studio" className="scroll-mt-24 border-t border-border/70">
          <FilmPage />
        </div>
      </section>
    </PublicPageShell>
  );
};

export default AIFilms;
