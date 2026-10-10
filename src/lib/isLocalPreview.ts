/** Local previews have no production telemetry or Vercel analytics endpoint. */
export function isLocalPreviewHost(): boolean {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);
}
