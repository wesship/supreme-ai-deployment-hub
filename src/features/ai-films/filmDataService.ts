import { supabase } from '@/integrations/supabase/client';
import type { AIFilm } from './catalog';

export type RemoteFilmLibraryEntry = {
  filmId: string;
  saved: boolean;
  progress: number;
  lastPositionSeconds: number;
};

export const fetchPublishedFilms = async (): Promise<AIFilm[]> => {
  const { data, error } = await (supabase as any)
    .from('ai_films')
    .select('id,title,category,description,duration_label,release_year,maturity,topics,poster_url,trailer_url')
    .eq('published', true)
    .order('release_year', { ascending: false });

  if (error) throw error;

  return (data || []).map((film: any) => ({
    id: film.id,
    title: film.title,
    category: film.category,
    description: film.description,
    duration: film.duration_label,
    year: film.release_year,
    maturity: film.maturity,
    topics: film.topics || [],
    posterUrl: film.poster_url || undefined,
    trailerUrl: film.trailer_url || undefined,
  }));
};

export const fetchFilmLibrary = async (): Promise<RemoteFilmLibraryEntry[]> => {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from('ai_film_library')
    .select('film_id,saved,progress,last_position_seconds')
    .eq('user_id', user.id);

  if (error) throw error;

  return (data || []).map((entry: any) => ({
    filmId: entry.film_id,
    saved: Boolean(entry.saved),
    progress: Number(entry.progress || 0),
    lastPositionSeconds: Number(entry.last_position_seconds || 0),
  }));
};

export const upsertFilmLibraryEntry = async (entry: RemoteFilmLibraryEntry): Promise<void> => {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error('Authentication is required to sync the AI Films library.');

  const { error } = await (supabase as any)
    .from('ai_film_library')
    .upsert({
      user_id: user.id,
      film_id: entry.filmId,
      saved: entry.saved,
      progress: Math.max(0, Math.min(100, Math.round(entry.progress))),
      last_position_seconds: Math.max(0, Math.round(entry.lastPositionSeconds)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,film_id' });

  if (error) throw error;
};

export const askFilmCompanion = async (filmId: string, question: string) => {
  const { data, error } = await supabase.functions.invoke('ai-film-companion', {
    body: { filmId, question },
  });

  if (error) throw error;
  return data as { answer: string; citations?: Array<{ startSeconds: number; endSeconds: number; content: string }> };
};
