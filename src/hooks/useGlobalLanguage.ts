import { useEffect, useState } from 'react';
import { normalizeLocale, type SupportedLocale } from '../lib/global-language';

export function useGlobalLanguage(): SupportedLocale {
  const [locale, setLocale] = useState<SupportedLocale>(() => typeof document === 'undefined' ? 'en' : normalizeLocale(document.documentElement.lang));
  useEffect(() => {
    const sync = () => setLocale(normalizeLocale(document.documentElement.lang));
    window.addEventListener('d3vonn:locale-change', sync);
    return () => window.removeEventListener('d3vonn:locale-change', sync);
  }, []);
  return locale;
}
