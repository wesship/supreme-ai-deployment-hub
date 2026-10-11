import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

for (const width of [390, 768]) {
  test(`Film responsive acceptance at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const samples: Array<{ at: number; size: number; element: string }> = [];
      (window as Window & { __lcpSamples?: typeof samples }).__lcpSamples = samples;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const lcp = entry as PerformanceEntry & { size?: number; element?: Element };
            samples.push({ at: Math.round(entry.startTime), size: lcp.size ?? 0, element: lcp.element?.tagName ?? 'unknown' });
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { /* older browser: no LCP API */ }
    });
    await page.goto('/film', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText('Sovereign Signal', { timeout: 20_000 });
    const skip = page.getByRole('button', { name: /skip intro/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.screenshot({ path: `test-results/film-${width}.png`, fullPage: true });
    const sizes = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(sizes.documentWidth, `unexpected horizontal overflow at ${width}px`).toBeLessThanOrEqual(sizes.viewportWidth + 1);
    const diagnostics = await page.evaluate(() => {
      const hero = document.querySelector('img[fetchpriority="high"]') as HTMLImageElement | null;
      const resource = hero?.currentSrc
        ? performance.getEntriesByName(hero.currentSrc, 'resource')[0] as PerformanceResourceTiming | undefined
        : undefined;
      return {
        navigationMs: Math.round(performance.now()),
        lcpSamples: (window as Window & { __lcpSamples?: unknown[] }).__lcpSamples ?? [],
        heroImage: hero ? {
          complete: hero.complete,
          naturalWidth: hero.naturalWidth,
          decodeReady: hero.complete && hero.naturalWidth > 0,
          resourceResponseEndMs: resource ? Math.round(resource.responseEnd) : null,
          visibility: getComputedStyle(hero).visibility,
          opacity: getComputedStyle(hero).opacity,
        } : null,
      };
    });
    mkdirSync('test-results', { recursive: true });
    writeFileSync(`test-results/film-mobile-timing-${width}.json`, JSON.stringify(diagnostics, null, 2));
    expect(errors, 'uncaught browser exceptions').toEqual([]);
  });
}
