/**
 * Example server-side/edge proxy contract for HNFPORTAL.one.
 *
 * Adapt to Supabase Edge Functions, Next.js route handlers, Cloudflare Workers,
 * or another server runtime. Do not expose HNF_HERMES_API_KEY to the browser.
 */
import { HNFHermesClient } from './hnf-hermes-client';

const key = Deno.env.get('HNF_HERMES_API_KEY') ?? '';
const client = new HNFHermesClient({ apiKey: key });

export async function handleHNFHermesProxy(request: Request): Promise<Response> {
  if (!key) {
    return Response.json({ error: 'hermes_not_configured' }, { status: 503 });
  }

  // The hosting app must verify its authenticated user/admin role before
  // allowing this proxy to submit or approve protected work.
  const url = new URL(request.url);
  const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));

  if (url.pathname.endsWith('/capabilities')) {
    return Response.json(await client.capabilities());
  }

  if (url.pathname.endsWith('/workflow')) {
    const result = await client.runWorkflow(String(body.workflow), body.request);
    return Response.json(result, { status: 202 });
  }

  if (url.pathname.endsWith('/status')) {
    return Response.json(await client.getRequest(String(body.request_id)));
  }

  if (url.pathname.endsWith('/decision')) {
    // Require HNF admin authorization before reaching this branch.
    return Response.json(await client.decide(String(body.request_id), body.decision));
  }

  return Response.json({ error: 'not_found' }, { status: 404 });
}
