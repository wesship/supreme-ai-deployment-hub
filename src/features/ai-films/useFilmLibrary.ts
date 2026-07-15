import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'd3vonn-ai-films-library-v1';

export type FilmLibraryState = {
  saved: string[];
  progress: Record<string, number>;
};

const initialState: FilmLibraryState = { saved: [], progress: {} };

const readState = (): FilmLibraryState => {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<FilmLibraryState>;
    return {
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      progress: parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {},
    };
  } catch {
    return initialState;
  }
};

export const useFilmLibrary = () => {
  const [state, setState] = useState<FilmLibraryState>(readState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const toggleSaved = useCallback((filmId: string) => {
    setState((current) => ({
      ...current,
      saved: current.saved.includes(filmId)
        ? current.saved.filter((id) => id !== filmId)
        : [...current.saved, filmId],
    }));
  }, []);

  const setProgress = useCallback((filmId: string, progress: number) => {
    const normalized = Math.max(0, Math.min(100, Math.round(progress)));
    setState((current) => ({
      ...current,
      progress: { ...current.progress, [filmId]: normalized },
    }));
  }, []);

  return { state, toggleSaved, setProgress };
};
