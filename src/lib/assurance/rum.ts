type VitalName = 'LCP' | 'INP' | 'CLS';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';
const RUM_ENABLED = import.meta.env.VITE_RUM_ENABLED !== 'false';

export function recordVital(name: VitalName, value: number): void {
  if (!RUM_ENABLED) return;
  const route = window.location.pathname || '/';
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const body = JSON.stringify({
    name,
    value,
    route,
    navigation_type: navigation?.type || 'navigate',
    deployment: import.meta.env.MODE,
  });
  const endpoint = `${API_BASE}/api/assurance/public/rum`;
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    return;
  }
  void fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } });
}

export function startRumCollection(): void {
  if (!RUM_ENABLED || !('PerformanceObserver' in window)) return;
  for (const metric of ['largest-contentful-paint', 'layout-shift', 'event'] as const) {
    try {
      const observer = new PerformanceObserver((entries) => {
        const entry = entries.getEntries().at(-1) as PerformanceEntry & { value?: number; duration?: number } | undefined;
        if (!entry) return;
        if (metric === 'largest-contentful-paint') recordVital('LCP', entry.startTime);
        if (metric === 'layout-shift' && entry.value) recordVital('CLS', entry.value);
        if (metric === 'event' && entry.duration) recordVital('INP', entry.duration);
      });
      observer.observe({ type: metric, buffered: true });
    } catch {
      // Browser does not support this metric type; omit rather than degrade the page.
    }
  }
}
