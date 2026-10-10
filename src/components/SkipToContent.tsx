/**
 * Visible-on-focus skip link. WCAG 2.4.1 (Bypass Blocks).
 * Targets the #main-content landmark.
 */
export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="
        sr-only focus:not-sr-only
        focus:fixed focus:top-3 focus:left-3 focus:z-[100]
        focus:px-4 focus:py-2 focus:rounded-md
        focus:bg-primary focus:text-primary-foreground
        focus:shadow-lg focus:outline-none
        focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-background
        font-medium text-sm
      "
    >
      Skip to main content
    </a>
  );
}
