import { next } from '@vercel/functions';

const CSP_REPORT_ENDPOINT = 'https://api.d3vonn.io/api/assurance/public/csp-reports';

function createNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function cspFor(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://apis.google.com https://cdn.jsdelivr.net https://*.supabase.co https://*.sentry.io https://*.vercel-insights.com`,
    "worker-src 'self' blob:",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://www.d3vonn.io",
    "connect-src 'self' https://api.d3vonn.io https://www.googleapis.com https://accounts.google.com https://api.vapi.ai wss://api.vapi.ai https://*.daily.co wss://*.daily.co https://*.pluot.blue wss://*.pluot.blue https://*.supabase.co https://*.sentry.io wss://*.supabase.co https://*.vercel-insights.com",
    "frame-src 'self' https://apis.google.com https://docs.google.com https://drive.google.com https://accounts.google.com https://*.daily.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
    `report-uri ${CSP_REPORT_ENDPOINT}`,
  ].join('; ');
}

export default function middleware(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith('/assets/') || pathname.startsWith('/favicon') || pathname.endsWith('.xml') || pathname.endsWith('.txt')) {
    return next();
  }

  const nonce = createNonce();
  const policy = cspFor(nonce);
  return next({
    headers: {
      'Content-Security-Policy': policy,
      'Content-Security-Policy-Report-Only': policy,
      'X-CSP-Nonce-Generated': '1',
      'Vary': 'Accept-Encoding',
    },
  });
}

export const config = {
  matcher: '/:path*',
};
