import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls window to top on every route change.
 * When a #hash is present (either via React Router navigation, a direct page
 * load, or a native hashchange), smooth-scrolls to the matching element.
 *
 * Retries for ~3s to handle lazy-loaded routes whose targets mount after
 * the initial render.
 */
function scrollToHash(rawHash: string) {
  const id = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  if (!id) return;

  let cancelled = false;
  let attempt = 0;
  const maxAttempts = 30; // ~3s at 100ms

  const tryScroll = () => {
    if (cancelled) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (attempt < maxAttempts) {
      attempt += 1;
      setTimeout(tryScroll, 100);
    }
  };

  tryScroll();

  return () => {
    cancelled = true;
  };
}

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  // Route changes (including hash changes via React Router <Link>).
  useEffect(() => {
    if (hash) {
      return scrollToHash(hash);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  // Native hashchange events (e.g. plain <a href="#section"> clicks or
  // programmatic location.hash mutations) — React Router won't re-render
  // the effect above for these.
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash) scrollToHash(window.location.hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return null;
}
