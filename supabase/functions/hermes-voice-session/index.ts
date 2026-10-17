// Authenticated voice session preflight. This does NOT mint provider credentials or invoke Hermes.
// Supabase function deployment must enforce JWT verification; also validate identity here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  const allowedOrigin = Deno.env.get("VOICE_UI_ALLOWED_ORIGIN");
  if (!allowedOrigin || !origin || origin !== allowedOrigin) return json({ error: "Origin not allowed" }, 403);
  const headers = { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" };
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, headers);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json({ error: "Unavailable" }, 503, headers);
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(auth.slice(7));
  if (error || !data.user) return json({ error: "Unauthorized" }, 401, headers);
  // Deliberately fail closed until durable session storage, quotas, revocation and provider
  // credential issuance are implemented. Do not return a fabricated active session.
  return json({ status: "not_configured", authenticated: true, voiceEnabled: false }, 503, headers);
});
