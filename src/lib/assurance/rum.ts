type VitalName = 'LCP' | 'INP' | 'CLS';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';

export function recordVital(name: VitalName, value: number): void {
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

  // Keep the beacon request CORS-simple. application/json can force a
  // cross-origin preflight, which is especially fragile for fire-and-forget
  // telemetry. The API still parses the JSON request body normally.
  if (navigator.sendBeacon) {
    const accepted = navigator.sendBeacon(
      endpoint,
      new Blob([body], { type: 'text/plain;charset=UTF-8' }),
    );
    if (accepted) return;
  }

  void fetch(endpoint, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
  }).catch(() => {
    // RUM must never degrade the application when telemetry is unavailable.
  });
}

export function startRumCollection(): void {
  if (!('PerformanceObserver' in window)) return;
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
