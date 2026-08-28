import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  Bot,
  Film,
  Info,
  MessageCircle,
  Play,
  Search,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import PublicPageShell from '@/components/shell/PublicPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { aiFilmCatalog, aiFilmCategories, type AIFilm } from '@/features/ai-films/catalog';
import { useFilmLibrary } from '@/features/ai-films/useFilmLibrary';
import { useFeatureFlag } from '@/lib/featureFlags';

const FilmPage = lazy(() => import('./Film'));

const breadcrumbs = [{ label: 'AI Films' }, { label: 'D3VONN Studios' }];
const INTRO_STORAGE_KEY = 'd3vonn-ai-films-intro-seen';
const featuredFilm = aiFilmCatalog.find((film) => film.featured) ?? aiFilmCatalog[0]!;

function FilmPreviewMedia({ film, featured = false }: { film: AIFilm; featured?: boolean }) {
  const previewLabel = film.trailerUrl
    ? `${film.title} preview clip`
    : `${film.title} is in development; no preview video has been published`;
  const shouldShowFeaturedPoster = featured && Boolean(film.posterUrl);

  return (
    <div className={`overflow-hidden bg-[radial-gradient(circle_at_70%_25%,rgba(34,211,238,.45),transparent_25%),linear-gradient(135deg,#06142b,#02040a_70%)] ${featured ? 'absolute inset-0' : 'relative aspect-video'}`}>
      {shouldShowFeaturedPoster ? (
        <img
          src={film.posterUrl}
          alt=""
          className="h-full w-full object-cover object-[68%_center]"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      ) : film.trailerUrl ? (
        <video
          aria-hidden="true"
          className="h-full w-full object-cover object-[68%_center] transition duration-700 group-hover:scale-105"
          autoPlay={!featured}
          loop
          muted
          playsInline
          poster={film.posterUrl}
          preload="none"
          src={film.trailerUrl}
          tabIndex={-1}
        />
      ) : film.posterUrl ? (
        <img src={film.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div aria-hidden="true" className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_72%_20%,rgba(34,211,238,.28),transparent_26%),linear-gradient(135deg,#071a36,#02040a_78%)]">
          <Film className="h-11 w-11 text-cyan-200/90" />
        </div>
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/5 to-slate-950/10" />
      {!featured && <span className="absolute bottom-3 left-4 right-4 truncate text-xs font-medium tracking-wide text-white/90">{previewLabel}</span>}
    </div>
  );
}

const AIFilms = () => {
  const [showIntro, setShowIntro] = useState(false);
  const [muted, setMuted] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedFilm, setSelectedFilm] = useState<AIFilm | null>(null);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [companionQuery, setCompanionQuery] = useState('');
  const [companionAnswer, setCompanionAnswer] = useState('Select a film and ask a question grounded in its approved transcript.');
  const [companionBusy, setCompanionBusy] = useState(false);
  const [studioReady, setStudioReady] = useState(false);
  const studioAnchorRef = useRef<HTMLDivElement | null>(null);
  const companionEnabled = useFeatureFlag('ai_film_companion');
  const { state: library, toggleSaved, setProgress } = useFilmLibrary();

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

  useEffect(() => {
    const anchor = studioAnchorRef.current;
    if (!anchor || studioReady) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStudioReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '500px 0px' },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [studioReady]);

  useEffect(() => {
    if (!studioReady) return;
    const studioRoot = document.getElementById('openmontage-studio-anchor');
    const nestedSearch = studioRoot?.querySelector<HTMLInputElement>('input[placeholder="Search films, topics, or series"]');
    if (nestedSearch && !nestedSearch.hasAttribute('aria-label')) {
      nestedSearch.setAttribute('aria-label', 'Search OpenMontage films, topics, or series');
    }
  }, [studioReady]);

  const visibleFilms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return aiFilmCatalog.filter((film) => {
      const matchesCategory = activeCategory === 'All' || film.category === activeCategory;
      const haystack = `${film.title} ${film.description} ${film.category} ${film.topics.join(' ')}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [activeCategory, query]);

  const continueWatching = useMemo(
    () => aiFilmCatalog.filter((film) => (library.progress[film.id] || 0) > 0 && (library.progress[film.id] || 0) < 100),
    [library.progress],
  );

  const savedFilms = useMemo(
    () => aiFilmCatalog.filter((film) => library.saved.includes(film.id)),
    [library.saved],
  );

  const closeIntro = () => {
    window.localStorage.setItem(INTRO_STORAGE_KEY, 'true');
    setShowIntro(false);
  };

  const openFilm = (film: AIFilm) => {
    setSelectedFilm(film);
    setProgress(film.id, Math.max(library.progress[film.id] || 0, 5));
  };

  const askCompanion = async () => {
    const film = selectedFilm || aiFilmCatalog.find((item) => item.featured) || aiFilmCatalog[0];
    const question = companionQuery.trim();
    if (!question || companionBusy) return;
    setCompanionBusy(true);
    setCompanionAnswer('Searching the approved transcript…');
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('ai-film-companion', {
        body: { filmId: film.id, question },
      });
      if (error) {
        const payload = error.context && typeof error.context.json === 'function' ? await error.context.json().catch(() => ({})) : {};
        throw new Error(payload.message || error.message || 'The AI Film Companion is unavailable.');
      }
      if (!data?.answer) throw new Error(data?.message || 'The AI Film Companion returned no answer.');
      setCompanionAnswer(data.answer);
      setCompanionQuery('');
    } catch (error) {
      setCompanionAnswer(error instanceof Error ? error.message : 'The AI Film Companion is unavailable.');
    } finally {
      setCompanionBusy(false);
    }
  };

  const scrollToStudio = () => {
    setStudioReady(true);
    window.requestAnimationFrame(() => {
      document.getElementById('openmontage-studio-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const FilmCard = ({ film }: { film: AIFilm }) => {
    const progress = library.progress[film.id] || 0;
    const saved = library.saved.includes(film.id);
    return (
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        className="group overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-2xl shadow-black/10 backdrop-blur"
      >
        <div className="relative">
          <FilmPreviewMedia film={film} />
          <div className="absolute bottom-5 right-5 flex gap-2">
            <Button type="button" size="icon" variant="secondary" aria-label={saved ? `Remove ${film.title} from My Library` : `Add ${film.title} to My Library`} onClick={() => toggleSaved(film.id)}>
              {saved ? <BookmarkCheck aria-hidden="true" className="h-5 w-5" /> : <Bookmark aria-hidden="true" className="h-5 w-5" />}
            </Button>
            <Button type="button" size="icon" className="rounded-full" aria-label={film.trailerUrl ? `Watch ${film.title} preview` : `View ${film.title} details`} onClick={() => openFilm(film)}>
              {film.trailerUrl ? <Play aria-hidden="true" className="h-5 w-5" /> : <Info aria-hidden="true" className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="outline">{film.category}</Badge>
            <span className="text-xs text-muted-foreground">{film.duration}</span>
          </div>
          <h3 className="mt-4 text-xl font-bold">{film.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{film.description}</p>
          {progress > 0 && <Progress value={progress} className="mt-4 h-1.5" aria-label={`${progress}% watched`} />}
        </div>
      </motion.article>
    );
  };

  return (
    <PublicPageShell breadcrumbs={breadcrumbs}>
      <AnimatePresence>
        {showIntro && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="ai-films-intro-title" aria-describedby="ai-films-intro-description">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,105,255,0.35),transparent_42%),linear-gradient(135deg,#02040a,#07152f_55%,#000)]" />
            <motion.div className="relative z-10 max-w-4xl px-6 text-center" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.2 }}>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.45em] text-cyan-200">D3VONN.IO Presents</p>
              <h1 id="ai-films-intro-title" className="text-5xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl">AI FILMS</h1>
              <p id="ai-films-intro-description" className="mx-auto mt-6 max-w-2xl text-base text-blue-100 sm:text-xl">Stories engineered by intelligence. Built with OpenMontage. Governed by HERMES.</p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Button type="button" onClick={closeIntro} size="lg"><Play aria-hidden="true" className="mr-2 h-5 w-5" /> Enter Studios</Button>
                <Button type="button" onClick={() => setMuted((value) => !value)} variant="outline" size="icon" aria-label={muted ? 'Unmute intro' : 'Mute intro'} aria-pressed={!muted}>
                  {muted ? <VolumeX aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
                </Button>
              </div>
            </motion.div>
            <Button type="button" onClick={closeIntro} variant="ghost" className="absolute right-4 top-4 text-white" aria-label="Skip intro"><X aria-hidden="true" className="mr-2 h-4 w-4" /> Skip Intro</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <section aria-label="D3VONN AI Films" className="overflow-hidden bg-background">
        <div className="relative min-h-[72vh] border-b border-border/60">
          <FilmPreviewMedia film={featuredFilm} featured />
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_78%_30%,rgba(20,105,255,0.2),transparent_34%),linear-gradient(90deg,rgba(2,7,20,0.94)_0%,rgba(2,7,20,0.82)_33%,rgba(2,7,20,0.32)_64%,rgba(2,7,20,0.08)_100%)]" />
          <div className="container relative z-10 mx-auto flex min-h-[72vh] items-end px-4 pb-16 pt-28 sm:px-6 lg:pb-24">
            <div className="max-w-3xl">
              <Badge className="mb-5" variant="secondary">{featuredFilm.category} · Featured</Badge>
              <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl">{featuredFilm.title}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">{featuredFilm.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" size="lg" onClick={() => openFilm(featuredFilm)}><Play aria-hidden="true" className="mr-2 h-5 w-5" /> Play</Button>
                <Button type="button" size="lg" variant="outline" onClick={() => setSelectedFilm(featuredFilm)}><Info aria-hidden="true" className="mr-2 h-5 w-5" /> More Info</Button>
                <Button type="button" size="lg" variant="outline" onClick={scrollToStudio}><Sparkles aria-hidden="true" className="mr-2 h-5 w-5" /> Create a Film</Button>
                {companionEnabled && <Button type="button" size="lg" variant="outline" onClick={() => setCompanionOpen(true)} aria-label="Open AI Film Companion"><MessageCircle aria-hidden="true" className="mr-2 h-5 w-5" /> AI Companion</Button>}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto space-y-14 px-4 py-12 sm:px-6 lg:py-16">
          {continueWatching.length > 0 && (
            <section aria-labelledby="continue-watching-heading">
              <h2 id="continue-watching-heading" className="text-2xl font-bold">Continue Watching</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{continueWatching.map((film) => <FilmCard key={film.id} film={film} />)}</div>
            </section>
          )}

          {savedFilms.length > 0 && (
            <section aria-labelledby="my-library-heading">
              <h2 id="my-library-heading" className="text-2xl font-bold">My Library</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{savedFilms.map((film) => <FilmCard key={film.id} film={film} />)}</div>
            </section>
          )}

          <section aria-labelledby="catalog-heading">
            <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">D3VONN Studios</p><h2 id="catalog-heading" className="mt-2 text-3xl font-bold sm:text-4xl">Movies and Originals</h2></div>
              <div className="relative w-full lg:max-w-sm"><label htmlFor="movie-search" className="sr-only">Search movies, topics, or categories</label><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="movie-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movies, topics, or categories" className="pl-10" /></div>
            </div>
            <div className="mb-8 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Film categories">
              {aiFilmCategories.map((category) => <Button key={category} type="button" variant={activeCategory === category ? 'default' : 'outline'} size="sm" aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>{category}</Button>)}
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">{visibleFilms.map((film) => <FilmCard key={film.id} film={film} />)}</div>
          </section>
        </div>

        <div ref={studioAnchorRef} id="openmontage-studio-anchor" className="min-h-96 scroll-mt-24 border-t border-border/70">
          {studioReady ? (
            <Suspense fallback={<div className="container mx-auto px-4 py-16 text-sm text-muted-foreground">Loading OpenMontage Studio…</div>}>
              <FilmPage />
            </Suspense>
          ) : (
            <div className="container mx-auto px-4 py-16 text-center sm:px-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">OpenMontage Studio</p>
              <h2 className="mt-3 text-3xl font-bold">Create when you are ready</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">The full production studio loads only when you reach this section, keeping the movie catalog fast and responsive.</p>
              <Button type="button" className="mt-6" onClick={() => setStudioReady(true)}><Sparkles className="mr-2 h-4 w-4" /> Load Studio</Button>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selectedFilm && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedFilm(null)}>
            <Card className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto border-white/10 bg-slate-950 p-6 text-white" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="film-detail-title">
              <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3" onClick={() => setSelectedFilm(null)} aria-label="Close film details"><X className="h-5 w-5" /></Button>
              <Badge>{selectedFilm.category}</Badge><h2 id="film-detail-title" className="mt-4 text-3xl font-bold">{selectedFilm.title}</h2><p className="mt-4 text-slate-300">{selectedFilm.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-400"><span>{selectedFilm.year}</span><span>•</span><span>{selectedFilm.duration}</span><span>•</span><span>{selectedFilm.maturity}</span></div>
              <div className="mt-5 flex flex-wrap gap-2">{selectedFilm.topics.map((topic) => <Badge key={topic} variant="outline">{topic}</Badge>)}</div>
              {selectedFilm.trailerUrl ? (
                <figure className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-black">
                  <video controls autoPlay playsInline poster={selectedFilm.posterUrl} preload="metadata" className="aspect-video w-full" aria-describedby="selected-film-preview-caption" aria-label={`${selectedFilm.title} preview`} src={selectedFilm.trailerUrl}>Your browser does not support video playback.</video>
                  <figcaption id="selected-film-preview-caption" className="px-4 py-3 text-sm text-slate-300">Preview clip for <strong>{selectedFilm.title}</strong>. {selectedFilm.description} Spoken-word captions will be added when a verified transcript is available.</figcaption>
                </figure>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300"><strong>{selectedFilm.title}</strong> is in development. A title-specific preview will appear here when it is published.</div>
              )}
              <div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => setProgress(selectedFilm.id, Math.min(100, (library.progress[selectedFilm.id] || 0) + 20))}>{selectedFilm.trailerUrl ? <Play className="mr-2 h-4 w-4" /> : <Info className="mr-2 h-4 w-4" />}{selectedFilm.trailerUrl ? 'Track Preview Progress' : 'Track Interest'}</Button><Button variant="outline" onClick={() => toggleSaved(selectedFilm.id)}>{library.saved.includes(selectedFilm.id) ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />} My Library</Button>{companionEnabled && <Button variant="outline" onClick={() => setCompanionOpen(true)}><Bot className="mr-2 h-4 w-4" /> Ask AI</Button>}</div>
              {(library.progress[selectedFilm.id] || 0) > 0 && <Progress value={library.progress[selectedFilm.id]} className="mt-6" />}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {companionOpen && (
          <motion.aside className="fixed bottom-0 right-0 z-[60] h-[min(620px,90vh)] w-full max-w-md border-l border-t border-white/10 bg-slate-950 p-5 text-white shadow-2xl" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} aria-labelledby="companion-title">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-cyan-300" /><h2 id="companion-title" className="text-xl font-bold">AI Film Companion</h2></div><Button type="button" variant="ghost" size="icon" onClick={() => setCompanionOpen(false)} aria-label="Close AI Companion"><X className="h-5 w-5" /></Button></div>
            <Card className="mt-6 border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300" aria-live="polite">{companionAnswer}</Card>
            <div className="mt-5 flex gap-2"><label htmlFor="companion-query" className="sr-only">Ask the AI Film Companion</label><Input id="companion-query" value={companionQuery} onChange={(event) => setCompanionQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void askCompanion()} placeholder="Ask about this film..." className="border-white/10 bg-white/5" disabled={companionBusy} /><Button type="button" size="icon" onClick={() => void askCompanion()} aria-label="Send question" disabled={companionBusy}><Send className="h-4 w-4" /></Button></div>
            <p className="mt-4 text-xs text-slate-500">Answers are limited to approved transcript context and include retrieval-backed citations when available.</p>
          </motion.aside>
        )}
      </AnimatePresence>
    </PublicPageShell>
  );
};

export default AIFilms;