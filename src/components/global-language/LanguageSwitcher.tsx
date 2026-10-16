import { useEffect, useState } from "react";
import { defaultLocale, isRtlLocale, normalizeLocale, supportedLocales, type SupportedLocale } from "../../lib/global-language";

const STORAGE_KEY = "d3vonn:locale";
const labels: Record<SupportedLocale, string> = { en: "English", es: "Español", fr: "Français", de: "Deutsch", pt: "Português", ar: "العربية", zh: "中文", hi: "हिन्दी" };
function readPreference(): SupportedLocale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && supportedLocales.includes(saved as SupportedLocale)) return saved as SupportedLocale;
  } catch { /* Storage may be unavailable in privacy mode. */ }
  return normalizeLocale(window.navigator.language || defaultLocale);
}
export default function LanguageSwitcher() {
  const [locale, setLocale] = useState<SupportedLocale>(readPreference);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
    try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* Nonpersistent fallback */ }
    window.dispatchEvent(new CustomEvent("d3vonn:locale-change", { detail: { locale } }));
  }, [locale]);
  return (
    <label className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-neutral-950/95 px-3 py-2 text-sm text-white shadow-xl" dir="ltr">
      <span aria-hidden="true">🌐</span>
      <span className="sr-only">Website language</span>
      <select aria-label="Website language" value={locale} onChange={(event) => setLocale(normalizeLocale(event.target.value))} className="max-w-32 bg-transparent text-white focus:outline focus:outline-2 focus:outline-amber-400">
        {supportedLocales.map((code) => <option key={code} value={code} className="bg-neutral-950">{labels[code]}</option>)}
      </select>
    </label>
  );
}
